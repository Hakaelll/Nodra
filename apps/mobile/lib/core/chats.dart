import 'dart:math';
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api.dart';
import 'session.dart';

final chatUnreadProvider = FutureProvider.autoDispose<int>((ref) async {
  final session = ref.watch(sessionProvider).value;
  final org = session?.organizationId;
  if (org == null || session?.chatEnabled != true) return 0;
  final timer = Timer(const Duration(seconds: 8), ref.invalidateSelf);
  ref.onDispose(timer.cancel);
  return ChatRepository(ref.read(apiProvider), org).unreadCount();
});

class ChatRepository {
  ChatRepository(this.api, this.organizationId);

  final NodraApi api;
  final String organizationId;

  String get _base => '/organizations/$organizationId/chats';

  Future<Json> list() async =>
      await api.request('$_base?page=1&limit=100') as Json;

  Future<Json> candidates(String search) async => await api.request(
    '$_base/candidates?page=1&limit=100&search=${Uri.encodeQueryComponent(search)}',
  ) as Json;

  Future<Json> detail(String id) async =>
      await api.request('$_base/$id') as Json;

  Future<Json> messages(String id, int page) async =>
      await api.request('$_base/$id/messages?page=$page&limit=50') as Json;

  Future<Json> createManual(String title, List<String> participantIds) async =>
      await api.request(
        _base,
        method: 'POST',
        data: {
          'kind': 'MANUAL',
          'title': title,
          'participantIds': participantIds,
        },
      ) as Json;

  Future<Json> createForService(String serviceId) async => await api.request(
    _base,
    method: 'POST',
    data: {'kind': 'SERVICE', 'serviceId': serviceId},
  ) as Json;

  Future<Json> send(String id, String body, String nonce) async =>
      await api.request(
        '$_base/$id/messages',
        method: 'POST',
        data: {'body': body, 'clientNonce': nonce},
      ) as Json;

  Future<void> markRead(String id) async {
    await api.request('$_base/$id/read', method: 'POST', data: {});
  }

  Future<void> hide(String id) async {
    await api.request('$_base/$id', method: 'DELETE');
  }

  Future<int> unreadCount() async {
    final result = await api.request('$_base/unread-count') as Json;
    return result['chatsCount'] as int;
  }
}

String chatDisplayTitle(Json chat, String userId) {
  final people = (chat['participants'] as List).cast<Json>();
  if (chat['kind'] == 'MANUAL' && people.length == 2) {
    final other = people.firstWhere(
      (person) => person['userId'] != userId,
      orElse: () => people.first,
    );
    return '${other['firstName']} ${other['lastName']}'.trim();
  }
  return chat['title'] as String;
}

List<Json> chronologicalMessages(Iterable<Json> messages) {
  final sorted = messages.toList();
  sorted.sort((a, b) {
    final time = (a['createdAt'] as String).compareTo(b['createdAt'] as String);
    return time != 0 ? time : (a['id'] as String).compareTo(b['id'] as String);
  });
  return sorted;
}

String newChatNonce() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes
      .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
      .join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
