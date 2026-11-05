import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/locale.dart';
import '../l10n/translation.dart';

class LanguageSelector extends ConsumerStatefulWidget {
  const LanguageSelector({super.key});
  @override
  ConsumerState<LanguageSelector> createState() => _LanguageSelectorState();
}

class _LanguageSelectorState extends ConsumerState<LanguageSelector> {
  String? error;

  Future<void> select(String language) async {
    setState(() => error = null);
    try {
      await ref.read(localeProvider.notifier).select(language);
    } catch (_) {
      if (mounted && ref.read(localeProvider).languageCode == language) {
        setState(
          () => error = 'No se pudo guardar el idioma. Vuelve a intentarlo.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(localeProvider).languageCode;
    return DropdownButtonFormField<String>(
      key: ValueKey(language),
      initialValue: language,
      decoration: InputDecoration(
        labelText: tr(context, 'Idioma'),
        errorText: error == null ? null : tr(context, error!),
      ),
      items: [
        DropdownMenuItem(value: 'es', child: Text(tr(context, 'Español'))),
        DropdownMenuItem(value: 'en', child: Text('English')),
      ],
      onChanged: (value) {
        if (value != null) select(value);
      },
    );
  }
}
