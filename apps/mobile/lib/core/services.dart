import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api.dart';
import 'session.dart';

typedef HomePage = ({String filter, int page});
final dashboardProvider = FutureProvider.autoDispose.family<Json, HomePage>((
  ref,
  query,
) async {
  final org = ref.watch(sessionProvider).value?.organizationId;
  if (org == null) return {'items': <Json>[], 'total': 0};
  return await ref
          .read(apiProvider)
          .request(
            '/organizations/$org/dashboard?filter=${query.filter}&page=${query.page}&limit=5',
          )
      as Json;
});
final pendingNoticesProvider = FutureProvider.autoDispose.family<Json, int>((
  ref,
  page,
) async {
  final org = ref.watch(sessionProvider).value?.organizationId;
  if (org == null) return {'items': <Json>[], 'total': 0};
  return await ref
          .read(apiProvider)
          .request(
            '/organizations/$org/notices?pendingAcknowledgement=true&page=$page&limit=5',
          )
      as Json;
});

typedef ServicesQuery = ({
  int page,
  String search,
  String status,
  String jobRoleId,
  String from,
  String to,
});
final servicesProvider = FutureProvider.autoDispose.family<Json, ServicesQuery>(
  (ref, query) async {
    final org = ref.watch(sessionProvider).value?.organizationId;
    if (org == null) return {'items': <Json>[], 'total': 0};
    final params = Uri(
      queryParameters: {
        'page': '${query.page}',
        if (query.search.isNotEmpty) 'search': query.search,
        if (query.status.isNotEmpty) 'status': query.status,
        if (query.jobRoleId.isNotEmpty) 'jobRoleId': query.jobRoleId,
        if (query.from.isNotEmpty) 'from': query.from,
        if (query.to.isNotEmpty) 'to': query.to,
      },
    ).query;
    return await ref
            .read(apiProvider)
            .request('/organizations/$org/services?$params')
        as Json;
  },
);
final serviceProvider = FutureProvider.autoDispose.family<Json, String>((
  ref,
  id,
) async {
  final org = ref.watch(sessionProvider).value?.organizationId;
  if (org == null) throw const ApiFailure('Selecciona una organización.');
  return await ref.read(apiProvider).request('/organizations/$org/services/$id')
      as Json;
});
final noticesProvider = FutureProvider.autoDispose.family<Json, int>((
  ref,
  page,
) async {
  final org = ref.watch(sessionProvider).value?.organizationId;
  if (org == null) return {'items': <Json>[], 'total': 0};
  return await ref
          .read(apiProvider)
          .request('/organizations/$org/notices?page=$page')
      as Json;
});
final serviceActivityProvider = FutureProvider.autoDispose.family<Json, int>((
  ref,
  page,
) async {
  final org = ref.watch(sessionProvider).value?.organizationId;
  if (org == null) return {'items': <Json>[], 'total': 0};
  return await ref
          .read(apiProvider)
          .request('/organizations/$org/service-activity?page=$page')
      as Json;
});

final calendarProvider = FutureProvider.autoDispose.family<Json, String?>((
  ref,
  month,
) async {
  final org = ref.watch(sessionProvider).value?.organizationId;
  if (org == null) throw const ApiFailure('Selecciona una organización.');
  final query = month == null
      ? ''
      : '?month=${Uri.encodeQueryComponent(month)}';
  return await ref
          .read(apiProvider)
          .request('/organizations/$org/calendar$query')
      as Json;
});

class CoordinationRepository {
  CoordinationRepository(this.api, this.organizationId);
  final NodraApi api;
  final String organizationId;
  Future<void> interest(String position, bool interested) async {
    await api.request(
      '/organizations/$organizationId/positions/$position/interest',
      method: 'POST',
      data: {'interested': interested},
    );
  }

  Future<void> respond(String assignment, String response) async {
    await api.request(
      '/organizations/$organizationId/assignments/$assignment/respond',
      method: 'POST',
      data: {'response': response},
    );
  }

  Future<void> acknowledge(String notice) async {
    await api.request(
      '/organizations/$organizationId/notices/$notice/acknowledge',
      method: 'POST',
      data: {},
    );
  }
}
