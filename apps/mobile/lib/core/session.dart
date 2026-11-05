import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api.dart';
import 'organization_customization.dart';

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
  OrganizationCustomization get customization => signedIn
      ? OrganizationCustomization.fromJson(organization?['customization'])
      : OrganizationCustomization.defaults;
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
  int _operation = 0;
  bool _isCurrent(int operation) => ref.mounted && operation == _operation;
  SessionState _snapshot() =>
      ref.mounted ? state.value ?? const SessionState() : const SessionState();

  @override
  Future<SessionState> build() async {
    final operation = ++_operation;
    try {
      if (!await api.restore()) {
        return _isCurrent(operation) ? const SessionState() : _snapshot();
      }
      final loaded = await _load();
      return _isCurrent(operation) ? loaded : _snapshot();
    } catch (error) {
      if (!_isCurrent(operation)) return _snapshot();
      if (error is ApiFailure && error.unauthorized) {
        return const SessionState();
      }
      rethrow;
    }
  }

  Future<SessionState> _load() async {
    final profile = await api.request('/auth/me') as Json;
    final memberships = (await api.request('/organizations') as List)
        .cast<Json>();
    final saved = await api.savedOrganization();
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

  Future<void> login(String email, String password) async {
    final operation = ++_operation;
    try {
      await api.authenticate(email, password);
      if (!_isCurrent(operation)) return;
      final loaded = await _load();
      if (_isCurrent(operation)) state = AsyncData(loaded);
    } catch (_) {
      if (_isCurrent(operation)) rethrow;
    }
  }

  Future<void> reload() async {
    final operation = ++_operation;
    try {
      final loaded = await _load();
      if (_isCurrent(operation)) state = AsyncData(loaded);
    } catch (_) {
      if (_isCurrent(operation)) rethrow;
    }
  }

  Future<void> select(String id) async {
    final current = state.value;
    if (current == null ||
        !current.memberships.any(
          (m) => (m['organization'] as Json)['id'] == id,
        )) {
      return;
    }
    final operation = ++_operation;
    await api.rememberOrganization(id);
    if (!_isCurrent(operation)) return;
    state = AsyncData(
      SessionState(
        user: current.user,
        memberships: current.memberships,
        organizationId: id,
      ),
    );
  }

  Future<void> logout() async {
    ++_operation;
    state = const AsyncData(SessionState());
    await api.logout();
  }
}
