import '../l10n/translation.dart';

import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../core/avatar_crop.dart';
import '../design/theme.dart';
import '../design/widgets.dart';

class AvatarCropSheet extends StatefulWidget {
  const AvatarCropSheet({
    super.key,
    required this.preview,
    required this.rgba,
    required this.width,
    required this.height,
  });

  final Uint8List preview;
  final Uint8List rgba;
  final int width;
  final int height;

  @override
  State<AvatarCropSheet> createState() => _AvatarCropSheetState();
}

class _AvatarCropSheetState extends State<AvatarCropSheet> {
  double zoom = 1;
  Offset offset = Offset.zero;
  double startZoom = 1;
  Offset anchor = Offset.zero;
  bool saving = false;
  String? error;

  void updateZoom(double value, double side) {
    final scale = avatarBaseScale(widget.width, widget.height, side);
    setState(() {
      zoom = value;
      offset = Offset(
        clampAvatarOffset(offset.dx, widget.width, side, zoom, scale),
        clampAvatarOffset(offset.dy, widget.height, side, zoom, scale),
      );
    });
  }

  Future<void> save(double side) async {
    setState(() {
      saving = true;
      error = null;
    });
    try {
      final crop = avatarCropRect(
        width: widget.width,
        height: widget.height,
        viewport: side,
        zoom: zoom,
        offsetX: offset.dx,
        offsetY: offset.dy,
      );
      final jpeg = await compute(
        encodeAvatarCropPayload,
        AvatarCropPayload(widget.rgba, widget.width, widget.height, crop),
      );
      if (!mounted) return;
      if (jpeg.length > 512 * 1024) {
        setState(
          () => error =
              'La foto sigue siendo demasiado grande. Elige otra imagen.',
        );
        return;
      }
      Navigator.pop(context, jpeg);
    } catch (_) {
      if (mounted) {
        setState(
          () => error = 'No se pudo preparar la foto. Prueba con otra imagen.',
        );
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final side = math.min(
        constraints.maxWidth - 48,
        math.min(320.0, MediaQuery.sizeOf(context).height * 0.44),
      );
      final scale = avatarBaseScale(widget.width, widget.height, side);
      final displayedWidth = widget.width * scale * zoom;
      final displayedHeight = widget.height * scale * zoom;
      return SingleChildScrollView(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            24,
            18,
            24,
            24 + MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      tr(context, 'Centrar foto'),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    tooltip: tr(context, 'Cerrar sin guardar'),
                    onPressed: saving ? null : () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                tr(
                  context,
                  'Arrastra y pellizca para encuadrar. Así se verá tu foto de perfil.',
                ),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: side,
                height: side,
                child: Stack(
                  children: [
                    ClipOval(
                      child: GestureDetector(
                        onScaleStart: (details) {
                          startZoom = zoom;
                          anchor =
                              (details.localFocalPoint -
                                  Offset(side / 2, side / 2) -
                                  offset) /
                              zoom;
                        },
                        onScaleUpdate: (details) {
                          final nextZoom = (startZoom * details.scale).clamp(
                            1.0,
                            4.0,
                          );
                          final moved =
                              details.localFocalPoint -
                              Offset(side / 2, side / 2) -
                              anchor * nextZoom;
                          setState(() {
                            zoom = nextZoom;
                            offset = Offset(
                              clampAvatarOffset(
                                moved.dx,
                                widget.width,
                                side,
                                zoom,
                                scale,
                              ),
                              clampAvatarOffset(
                                moved.dy,
                                widget.height,
                                side,
                                zoom,
                                scale,
                              ),
                            );
                          });
                        },
                        child: Stack(
                          children: [
                            Positioned(
                              left: (side - displayedWidth) / 2 + offset.dx,
                              top: (side - displayedHeight) / 2 + offset.dy,
                              child: Image.memory(
                                widget.preview,
                                width: displayedWidth,
                                height: displayedHeight,
                                fit: BoxFit.fill,
                                gaplessPlayback: true,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    IgnorePointer(
                      child: Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Theme.of(context).colorScheme.primary,
                            width: 2,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  const Icon(Icons.zoom_out, color: mutedColor),
                  Expanded(
                    child: Slider(
                      value: zoom,
                      min: 1,
                      max: 4,
                      semanticFormatterCallback: (value) =>
                          tr(context, 'Ampliación ${value.toStringAsFixed(1)}'),
                      onChanged: saving
                          ? null
                          : (value) => updateZoom(value, side),
                    ),
                  ),
                  const Icon(Icons.zoom_in, color: mutedColor),
                ],
              ),
              if (error != null) ...[
                const SizedBox(height: 8),
                NodraInlineError(message: error!),
              ],
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: NodraButton(
                  label: saving
                      ? tr(context, 'Preparando foto…')
                      : tr(context, 'Usar esta foto'),
                  onPressed: saving ? null : () => save(side),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
