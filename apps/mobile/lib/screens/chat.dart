import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api.dart';
import '../core/chats.dart';
import '../core/session.dart';
import '../design/theme.dart';
import '../design/widgets.dart';

class ChatRouteScreen extends ConsumerWidget {
  const ChatRouteScreen({super.key, this.chatId});
  final String? chatId;

  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(sessionProvider)
      .when(
        loading: () =>
            const Scaffold(body: Center(child: CircularProgressIndicator())),
        error: (error, _) =>
            Scaffold(body: Center(child: Text(error.toString()))),
        data: (session) => session.organizationId == null
            ? const Scaffold(
                body: Center(child: Text('Selecciona una organización.')),
              )
            : !session.chatEnabled
            ? Scaffold(
                appBar: AppBar(title: const Text('Chat')),
                body: const Center(
                  child: Text('Chat no disponible en esta organización.'),
                ),
              )
            : ChatScreen(
                key: ValueKey(session.organizationId),
                session: session,
                initialChatId: chatId,
              ),
      );
}

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key, required this.session, this.initialChatId});
  final SessionState session;
  final String? initialChatId;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen>
    with WidgetsBindingObserver {
  final draft = TextEditingController();
  final scroll = ScrollController();
  List<Json> chats = [], messages = [];
  Json? active;
  String? error, nonce;
  bool loading = true, sending = false, foreground = true;
  int messagePage = 1, totalMessages = 0, sequence = 0;
  Timer? timer;

  ChatRepository get repository =>
      ChatRepository(ref.read(apiProvider), widget.session.organizationId!);
  String get userId => widget.session.user!['id'] as String;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(loadChats());
    if (widget.initialChatId != null) unawaited(open(widget.initialChatId!));
    timer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!foreground) return;
      if (active != null) {
        unawaited(loadMessages(quiet: true));
      } else {
        unawaited(loadChats(quiet: true));
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
    if (foreground) {
      if (active != null) {
        unawaited(loadMessages());
      } else {
        unawaited(loadChats());
      }
    }
  }

  @override
  void dispose() {
    sequence++;
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    draft.dispose();
    scroll.dispose();
    super.dispose();
  }

  Future<void> loadChats({bool quiet = false}) async {
    try {
      final result = await repository.list();
      if (mounted) {
        setState(() {
          chats = (result['items'] as List).cast<Json>();
          loading = false;
          if (!quiet) error = null;
        });
      }
    } catch (failure) {
      if (mounted && !quiet) {
        setState(() {
          error = failure.toString();
          loading = false;
        });
      }
    }
  }

  Future<void> open(String id) async {
    final request = ++sequence;
    setState(() {
      loading = true;
      error = null;
      messages = [];
      draft.clear();
      nonce = null;
    });
    try {
      final chat = await repository.detail(id);
      if (!mounted || request != sequence) return;
      setState(() {
        active = chat;
        loading = false;
      });
      await loadMessages();
    } catch (failure) {
      if (mounted && request == sequence) {
        setState(() {
          error = failure.toString();
          loading = false;
        });
      }
    }
  }

  Future<void> loadMessages({bool quiet = false, int page = 1}) async {
    final chat = active;
    if (chat == null) return;
    final id = chat['id'] as String;
    final request = sequence;
    try {
      final result = await repository.messages(id, page);
      if (!mounted || request != sequence || active?['id'] != id) return;
      final shouldScroll =
          page == 1 &&
          (!scroll.hasClients ||
              scroll.position.maxScrollExtent - scroll.offset < 80);
      final incoming = (result['items'] as List).cast<Json>();
      final byId = <String, Json>{
        for (final message in [...messages, ...incoming])
          message['id'] as String: message,
      };
      setState(() {
        messages = chronologicalMessages(byId.values);
        totalMessages = result['total'] as int;
        if (page > 1) messagePage = page;
        if (!quiet) error = null;
      });
      if (foreground && page == 1) {
        await repository.markRead(id);
        ref.invalidate(chatUnreadProvider);
      }
      if (shouldScroll) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && scroll.hasClients) {
            scroll.jumpTo(scroll.position.maxScrollExtent);
          }
        });
      }
    } catch (failure) {
      if (mounted && request == sequence && !quiet) {
        setState(() => error = failure.toString());
      }
    }
  }

  Future<void> send() async {
    if (sending || active == null || draft.text.trim().isEmpty) return;
    final id = active!['id'] as String;
    final body = draft.text.trim();
    final currentNonce = nonce ?? newChatNonce();
    nonce = currentNonce;
    setState(() {
      sending = true;
      error = null;
    });
    try {
      await repository.send(id, body, currentNonce);
      if (!mounted || active?['id'] != id) return;
      draft.clear();
      nonce = null;
      await loadMessages();
      if (scroll.hasClients) scroll.jumpTo(scroll.position.maxScrollExtent);
    } catch (failure) {
      if (mounted) setState(() => error = failure.toString());
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  void closeConversation() {
    sequence++;
    setState(() {
      active = null;
      messages = [];
      messagePage = 1;
      error = null;
    });
    unawaited(loadChats());
  }

  Future<void> create() async {
    final chat = await showModalBottomSheet<Json>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => ChatCreateSheet(repository: repository, userId: userId),
    );
    if (chat != null && mounted) await open(chat['id'] as String);
  }

  Future<void> deleteChat() async {
    final id = active?['id'] as String?;
    if (id == null || sending) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => NodraDialog(
        title: const Text('¿Borrar de tu lista?'),
        content: const Text(
          'Los demás participantes conservarán la conversación. Si llega un mensaje nuevo, volverá a aparecer.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Borrar de mi lista'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await repository.hide(id);
      ref.invalidate(chatUnreadProvider);
      if (mounted) closeConversation();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: active == null,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop && active != null) closeConversation();
    },
    child: Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        leading: active == null
            ? null
            : IconButton(
                onPressed: closeConversation,
                tooltip: 'Volver a los chats',
                icon: const Icon(Icons.arrow_back),
              ),
        title: Text(
          active == null ? 'Chat' : chatDisplayTitle(active!, userId),
        ),
        actions: [
          if (active != null)
            PopupMenuButton<String>(
              tooltip: 'Opciones del chat',
              enabled: !sending,
              icon: const Icon(Icons.more_horiz),
              onSelected: (_) => deleteChat(),
              itemBuilder: (_) => [
                const PopupMenuItem(
                  value: 'delete',
                  child: Text('Borrar de mi lista'),
                ),
              ],
            ),
          if (active == null)
            IconButton(
              onPressed: create,
              tooltip: 'Nuevo chat',
              icon: const Icon(Icons.add),
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (error != null)
              Padding(
                padding: const EdgeInsets.all(16),
                child: NodraError(
                  message: error!,
                  retry: active == null ? loadChats : loadMessages,
                ),
              ),
            if (loading)
              const Expanded(child: Center(child: CircularProgressIndicator()))
            else if (active == null)
              Expanded(
                child: chats.isEmpty
                    ? const Center(child: Text('No hay chats'))
                    : RefreshIndicator(
                        onRefresh: loadChats,
                        child: ListView.separated(
                          itemCount: chats.length,
                          separatorBuilder: (_, _) =>
                              const Divider(height: 1, indent: 76),
                          itemBuilder: (context, index) {
                            final chat = chats[index];
                            final name = chatDisplayTitle(chat, userId);
                            final last = chat['lastMessage'] as Json?;
                            final unread = chat['unreadCount'] as int? ?? 0;
                            return ListTile(
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 18,
                                vertical: 6,
                              ),
                              leading: CircleAvatar(
                                backgroundColor: const Color(0xffebe9ff),
                                child: chat['kind'] == 'SERVICE'
                                    ? Icon(
                                        Icons.group_outlined,
                                        color: Theme.of(context)
                                            .colorScheme
                                            .primary,
                                      )
                                    : Text(_initials(name)),
                              ),
                              title: Text(
                                name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Text(
                                last?['body'] as String? ?? 'Sin mensajes',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              trailing: unread == 0
                                  ? null
                                  : Badge(
                                      label: Text(
                                        unread > 99 ? '99+' : '$unread',
                                      ),
                                      backgroundColor: Theme.of(context)
                                          .colorScheme
                                          .primary,
                                    ),
                              onTap: () => open(chat['id'] as String),
                            );
                          },
                        ),
                      ),
              )
            else ...[
              Expanded(
                child: messages.isEmpty
                    ? const Center(child: Text('Todavía no hay mensajes'))
                    : ListView.builder(
                        controller: scroll,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        itemCount:
                            messages.length +
                            (messages.length < totalMessages ? 1 : 0),
                        itemBuilder: (context, index) {
                          if (messages.length < totalMessages && index == 0) {
                            return TextButton(
                              onPressed: () =>
                                  loadMessages(page: messagePage + 1),
                              child: const Text('Cargar mensajes anteriores'),
                            );
                          }
                          final message =
                              messages[index -
                                  (messages.length < totalMessages ? 1 : 0)];
                          final own = message['senderId'] == userId;
                          final person = (active!['participants'] as List)
                              .cast<Json>()
                              .where((p) => p['userId'] == message['senderId'])
                              .firstOrNull;
                          final name = own
                              ? 'Tú'
                              : person == null
                              ? 'Participante'
                              : '${person['firstName']} ${person['lastName']}';
                          return Align(
                            alignment: own
                                ? Alignment.centerRight
                                : Alignment.centerLeft,
                            child: Container(
                              constraints: BoxConstraints(
                                maxWidth:
                                    MediaQuery.sizeOf(context).width * .82,
                              ),
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.fromLTRB(13, 9, 13, 7),
                              decoration: BoxDecoration(
                                color: own
                                    ? const Color(0xffebe9ff)
                                    : const Color(0xfff4f5f9),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    name,
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .primary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(message['body'] as String),
                                  const SizedBox(height: 3),
                                  Text(
                                    TimeOfDay.fromDateTime(
                                      DateTime.parse(
                                        message['createdAt'] as String,
                                      ).toLocal(),
                                    ).format(context),
                                    style: const TextStyle(
                                      fontSize: 10,
                                      color: mutedColor,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 8, 14, 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        enabled: !sending,
                        controller: draft,
                        minLines: 1,
                        maxLines: 4,
                        maxLength: 4000,
                        onChanged: (_) {
                          nonce = null;
                          setState(() {});
                        },
                        decoration: const InputDecoration(
                          hintText: 'Escribe un mensaje',
                          counterText: '',
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 9),
                    IconButton.filled(
                      onPressed: sending || draft.text.trim().isEmpty
                          ? null
                          : send,
                      tooltip: 'Enviar mensaje',
                      icon: sending
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.send_outlined),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

String _initials(String name) => name
    .split(RegExp(r'\s+'))
    .where((part) => part.isNotEmpty)
    .take(2)
    .map((part) => part[0])
    .join()
    .toUpperCase();

class ChatCreateSheet extends StatefulWidget {
  const ChatCreateSheet({
    super.key,
    required this.repository,
    required this.userId,
  });
  final ChatRepository repository;
  final String userId;
  @override
  State<ChatCreateSheet> createState() => _ChatCreateSheetState();
}

class _ChatCreateSheetState extends State<ChatCreateSheet> {
  final title = TextEditingController();
  final selected = <String>{};
  List<Json> candidates = [];
  String? error;
  bool busy = false, loading = true;
  int sequence = 0;
  Timer? debounce;

  @override
  void initState() {
    super.initState();
    unawaited(search(''));
  }

  @override
  void dispose() {
    sequence++;
    debounce?.cancel();
    title.dispose();
    super.dispose();
  }

  Future<void> search(String text) async {
    final request = ++sequence;
    try {
      final result = await widget.repository.candidates(text);
      if (mounted && request == sequence) {
        setState(() {
          candidates = (result['items'] as List)
              .cast<Json>()
              .where((p) => p['userId'] != widget.userId)
              .toList();
          loading = false;
        });
      }
    } catch (failure) {
      if (mounted && request == sequence) {
        setState(() {
          error = failure.toString();
          loading = false;
        });
      }
    }
  }

  Future<void> create() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final chat = await widget.repository.createManual(
        selected.length == 1 ? 'Chat' : title.text.trim(),
        selected.toList(),
      );
      if (mounted) Navigator.pop(context, chat);
    } catch (failure) {
      if (mounted) {
        setState(() {
          busy = false;
          error = failure.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      20,
      18,
      20,
      MediaQuery.viewInsetsOf(context).bottom + 18,
    ),
    child: SizedBox(
      height: math.min(
        MediaQuery.sizeOf(context).height * .65,
        math.max(
          0,
          MediaQuery.sizeOf(context).height -
              MediaQuery.viewInsetsOf(context).bottom -
              80,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text('Nuevo chat', style: Theme.of(context).textTheme.titleLarge),
              const Spacer(),
              IconButton(
                onPressed: busy ? null : () => Navigator.pop(context),
                tooltip: 'Cerrar',
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            enabled: !busy,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: 'Buscar en tu equipo',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (text) {
              debounce?.cancel();
              debounce = Timer(
                const Duration(milliseconds: 180),
                () => search(text),
              );
            },
          ),
          const SizedBox(height: 12),
          if (error != null) NodraInlineError(message: error!),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    children: candidates.map((person) {
                      final id = person['userId'] as String;
                      final name =
                          '${person['firstName']} ${person['lastName']}';
                      return CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(name),
                        secondary: CircleAvatar(
                          radius: 18,
                          child: Text(_initials(name)),
                        ),
                        value: selected.contains(id),
                        onChanged: busy
                            ? null
                            : (checked) => setState(() {
                                if (checked == true) {
                                  selected.add(id);
                                } else {
                                  selected.remove(id);
                                }
                              }),
                      );
                    }).toList(),
                  ),
          ),
          if (selected.length > 1) ...[
            TextField(
              controller: title,
              enabled: !busy,
              maxLength: 120,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'Nombre del grupo'),
            ),
            const SizedBox(height: 12),
          ],
          FilledButton(
            onPressed:
                busy ||
                    selected.isEmpty ||
                    (selected.length > 1 && title.text.trim().isEmpty)
                ? null
                : create,
            child: Text(busy ? 'Creando…' : 'Crear chat'),
          ),
        ],
      ),
    ),
  );
}
