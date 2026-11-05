import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api.dart';

final localeProvider = NotifierProvider<LocaleController, Locale>(
  LocaleController.new,
);

class LocaleController extends Notifier<Locale> {
  int _revision = 0;
  Future<void> _writes = Future<void>.value();

  @override
  Locale build() {
    unawaited(_restore(_revision));
    return const Locale('es');
  }

  Future<void> _restore(int revision) async {
    try {
      final saved = await ref
          .read(apiProvider)
          .storage
          .read(key: 'nodra_locale');
      if (saved != null &&
          ref.mounted &&
          revision == _revision &&
          (saved == 'es' || saved == 'en')) {
        state = Locale(saved);
      }
    } catch (_) {
      // Language defaults remain usable when native storage is unavailable.
    }
  }

  Future<void> select(String language) {
    if (language != 'es' && language != 'en') {
      throw ArgumentError.value(language, 'language');
    }
    final revision = ++_revision;
    final storage = ref.read(apiProvider).storage;
    state = Locale(language);
    final write = _writes.catchError((Object _) {}).then((_) async {
      if (revision == _revision) {
        await storage.write(key: 'nodra_locale', value: language);
      }
    });
    _writes = write;
    return write;
  }
}
