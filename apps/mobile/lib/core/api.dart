import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final apiProvider = Provider<NodraApi>((ref) => NodraApi());
typedef Json = Map<String, dynamic>;

class NodraApi {
  NodraApi({Dio? client, FlutterSecureStorage? storage})
    : dio =
          client ??
          Dio(
            BaseOptions(
              baseUrl: const String.fromEnvironment(
                'API_URL',
                defaultValue: 'http://10.0.2.2:4000/api/v1',
              ),
              connectTimeout: const Duration(seconds: 12),
              receiveTimeout: const Duration(seconds: 15),
            ),
          ),
      storage = storage ?? const FlutterSecureStorage();
  final Dio dio;
  final FlutterSecureStorage storage;
  String? _access, _refresh;
  Future<void>? _refreshing;
  int _generation = 0;
  Future<void> _storageWrites = Future<void>.value();
  static const _sessionChanged = ApiFailure(
    'La sesión ha cambiado. Vuelve a intentarlo.',
  );

  void _requireGeneration(int generation) {
    if (generation != _generation) throw _sessionChanged;
  }

  Future<void> _persist(
    int generation,
    String? encoded, {
    String key = 'nodra_session',
  }) {
    final write = _storageWrites.then((_) async {
      if (generation != _generation) return;
      if (encoded == null) {
        await storage.delete(key: key);
      } else {
        await storage.write(key: key, value: encoded);
      }
    });
    // The caller receives the error; later writes can still use the queue.
    _storageWrites = write.then<void>(
      (_) {},
      onError: (Object error, StackTrace stack) {},
    );
    return write;
  }

  Future<bool> restore() async {
    final generation = _generation;
    await _storageWrites;
    final encoded = await storage.read(key: 'nodra_session');
    _requireGeneration(generation);
    if (encoded == null) return false;
    final data = jsonDecode(encoded) as Json;
    _access = data['accessToken'] as String?;
    _refresh = data['refreshToken'] as String?;
    return _refresh != null;
  }

  Future<void> rememberOrganization(String id) =>
      _persist(_generation, id, key: 'nodra_organization');

  Future<String?> savedOrganization() async {
    final generation = _generation;
    await _storageWrites;
    final saved = await storage.read(key: 'nodra_organization');
    _requireGeneration(generation);
    return saved;
  }

  Future<void> _save(Json data, int generation) async {
    _requireGeneration(generation);
    _access = data['accessToken'] as String;
    _refresh = data['refreshToken'] as String;
    await _persist(
      generation,
      jsonEncode({'accessToken': _access, 'refreshToken': _refresh}),
    );
    _requireGeneration(generation);
  }

  Future<Json> authenticate(String email, String password) async {
    final generation = ++_generation;
    _access = null;
    _refresh = null;
    _refreshing = null;
    await _persist(generation, null);
    await _persist(generation, null, key: 'nodra_organization');
    _requireGeneration(generation);
    try {
      final response = await dio.post<Json>(
        '/auth/login',
        data: {'email': email.trim().toLowerCase(), 'password': password},
      );
      await _save(response.data!, generation);
      _requireGeneration(generation);
      return response.data!['user'] as Json;
    } on DioException catch (error) {
      _requireGeneration(generation);
      throw ApiFailure.from(error);
    }
  }

  Future<void> register(
    String email,
    String password,
    String firstName,
    String lastName,
  ) async {
    try {
      await dio.post<Json>(
        '/auth/register',
        data: {
          'email': email.trim().toLowerCase(),
          'password': password,
          'firstName': firstName.trim(),
          'lastName': lastName.trim(),
        },
      );
    } on DioException catch (error) {
      throw ApiFailure.from(error);
    }
  }

  Future<void> requestPasswordReset(String email) async {
    try {
      await dio.post<Json>(
        '/auth/reset/request',
        data: {'email': email.trim().toLowerCase()},
      );
    } on DioException catch (error) {
      throw ApiFailure.from(error);
    }
  }

  Future<void> completePasswordReset(String token, String newPassword) async {
    try {
      await dio.post<Json>(
        '/auth/reset/complete',
        data: {'token': token, 'newPassword': newPassword},
      );
    } on DioException catch (error) {
      throw ApiFailure.from(error);
    }
  }

  Future<void> requestEmailVerification() async {
    await request('/auth/verify/request', method: 'POST');
  }

  Future<void> completeEmailVerification(
    String token, {
    String? password,
  }) async {
    try {
      await dio.post<Json>(
        '/auth/verify/complete',
        data: {'token': token, 'password': ?password},
      );
    } on DioException catch (error) {
      throw ApiFailure.from(error);
    }
  }

  Future<void> _rotate(int generation) async {
    _requireGeneration(generation);
    try {
      final result = await dio.post<Json>(
        '/auth/refresh',
        data: {'token': _refresh},
      );
      await _save(result.data!, generation);
    } on DioException catch (error) {
      _requireGeneration(generation);
      if (error.response?.statusCode == 401) {
        await clear();
        _requireGeneration(generation + 1);
      }
      rethrow;
    }
  }

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? data,
    String? contentType,
    ResponseType responseType = ResponseType.json,
    bool retry = true,
  }) async {
    final generation = _generation;
    try {
      final response = await dio.request<dynamic>(
        path,
        data: data,
        options: Options(
          method: method,
          headers: {'Authorization': 'Bearer $_access'},
          contentType: contentType,
          responseType: responseType,
        ),
      );
      _requireGeneration(generation);
      return response.data;
    } on DioException catch (error) {
      _requireGeneration(generation);
      if (error.response?.statusCode == 401 && retry && _refresh != null) {
        try {
          final refreshing = _refreshing ??= _rotate(generation);
          try {
            await refreshing;
          } finally {
            if (identical(_refreshing, refreshing)) _refreshing = null;
          }
          _requireGeneration(generation);
          return await request(
            path,
            method: method,
            data: data,
            contentType: contentType,
            responseType: responseType,
            retry: false,
          );
        } on DioException catch (refreshError) {
          throw ApiFailure.from(refreshError);
        }
      }
      throw ApiFailure.from(error);
    }
  }

  Future<Uint8List> ownAvatar() async {
    final bytes = await request(
      '/auth/me/avatar',
      responseType: ResponseType.bytes,
    ) as List<int>;
    return Uint8List.fromList(bytes);
  }

  Future<void> uploadAvatar(Uint8List jpeg) async {
    await request(
      '/auth/me/avatar',
      method: 'POST',
      data: jpeg,
      contentType: 'image/jpeg',
    );
  }

  Future<void> logout() async {
    final token = _refresh;
    try {
      await clear();
    } finally {
      if (token != null) {
        try {
          await dio.post('/auth/logout', data: {'token': token});
        } on DioException {
          // Local logout remains effective when remote revocation is unavailable.
        }
      }
    }
  }

  Future<void> clear() async {
    final generation = ++_generation;
    _access = null;
    _refresh = null;
    _refreshing = null;
    await _persist(generation, null);
    await _persist(generation, null, key: 'nodra_organization');
  }
}

class ApiFailure implements Exception {
  const ApiFailure(this.message, {this.unauthorized = false});
  final String message;
  final bool unauthorized;
  factory ApiFailure.from(DioException error) {
    final data = error.response?.data;
    final message = data is Map ? data['message'] : null;
    final fallback = switch (error.response?.statusCode) {
      400 => 'Revisa los datos e inténtalo de nuevo.',
      401 => 'Tu sesión ha caducado. Inicia sesión de nuevo.',
      403 => 'No tienes permiso para realizar esta acción.',
      404 => 'No se encontró lo que buscabas.',
      409 => 'Los datos han cambiado. Actualiza y vuelve a intentarlo.',
      413 => 'El archivo es demasiado grande.',
      429 => 'Demasiados intentos. Espera un momento y vuelve a probar.',
      null => 'Sin conexión. Comprueba tu red y vuelve a intentarlo. Tu sesión se conserva.',
      _ => 'No se pudo completar la operación. Vuelve a intentarlo.',
    };
    return ApiFailure(
      message is String && message.trim().isNotEmpty ? message : fallback,
      unauthorized: error.response?.statusCode == 401,
    );
  }
  @override
  String toString() => message;
}
