import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api.dart';

class SessionState {
  const SessionState({
    this.user,
    this.memberships = const [],
    this.organizationId,
  });
  final Json? user;
  final List<Json> memberships;
  final String? organizationId;
  bool get chatEnabled =>
      (organization?['features'] as Json?)?['chat'] != false;
  bool get signedIn => user != null;
  Json? get organization {
    for (final m in memberships) {
      if ((m['organization'] as Json)['id'] == organizationId) {
        return m['organization'] as Json;
      }
    }
    return null;
  }
}

final sessionProvider = AsyncNotifierProvider<SessionController, SessionState>(
  SessionController.new,
);

class SessionController extends AsyncNotifier<SessionState> {
  NodraApi get api => ref.read(apiProvider);
  @override
  Future<SessionState> build() async {
    if (!await api.restore()) return const SessionState();
    try {
      return await _load();
    } on ApiFailure catch (e) {
      if (e.unauthorized) return const SessionState();
      rethrow;
    }
  }

  Future<SessionState> _load() async {
    final profile = await api.request('/auth/me') as Json;
    final memberships = (await api.request('/organizations') as List)
        .cast<Json>();
    final saved = await api.storage.read(key: 'nodra_organization');
    final id =
        memberships.any((m) => (m['organization'] as Json)['id'] == saved)
        ? saved
        : memberships.isEmpty
        ? null
        : (memberships.first['organization'] as Json)['id'] as String;
    return SessionState(
      user: profile,
      memberships: memberships,
      organizationId: id,
    );
  }

  Future<void> login(
    String email,
    String password, {
    String? firstName,
    String? lastName,
  }) async {
    await api.authenticate(
      email,
      password,
      firstName: firstName,
      lastName: lastName,
    );
    state = AsyncData(await _load());
  }

  Future<void> reload() async {
    state = AsyncData(await _load());
  }

  Future<void> select(String id) async {
    final current = state.requireValue;
    if (!current.memberships.any(
      (m) => (m['organization'] as Json)['id'] == id,
    )) {
      return;
    }
    await api.storage.write(key: 'nodra_organization', value: id);
    state = AsyncData(
      SessionState(
        user: current.user,
        memberships: current.memberships,
        organizationId: id,
      ),
    );
  }

  Future<void> logout() async {
    await api.logout();
    state = const AsyncData(SessionState());
  }
}
