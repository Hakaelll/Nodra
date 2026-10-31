import 'dart:math' as math;
import 'dart:typed_data';

import 'package:image/image.dart' as image;

class AvatarCrop {
  const AvatarCrop({required this.x, required this.y, required this.size});
  final int x;
  final int y;
  final int size;
}

class AvatarCropPayload {
  const AvatarCropPayload(this.rgba, this.width, this.height, this.crop);
  final Uint8List rgba;
  final int width;
  final int height;
  final AvatarCrop crop;
}

Uint8List encodeAvatarCropPayload(AvatarCropPayload payload) =>
    encodeAvatarCrop(
      rgba: payload.rgba,
      width: payload.width,
      height: payload.height,
      crop: payload.crop,
    );

double avatarBaseScale(int width, int height, double viewport) =>
    math.max(viewport / width, viewport / height);

double clampAvatarOffset(
  double offset,
  int sourceLength,
  double viewport,
  double zoom,
  double baseScale,
) {
  final limit = math.max(0, (sourceLength * baseScale * zoom - viewport) / 2);
  return offset.clamp(-limit, limit).toDouble();
}

AvatarCrop avatarCropRect({
  required int width,
  required int height,
  required double viewport,
  required double zoom,
  required double offsetX,
  required double offsetY,
}) {
  final scale = avatarBaseScale(width, height, viewport) * zoom;
  final size = (viewport / scale)
      .round()
      .clamp(1, math.min(width, height))
      .toInt();
  final left = (viewport - width * scale) / 2 + offsetX;
  final top = (viewport - height * scale) / 2 + offsetY;
  return AvatarCrop(
    x: (-left / scale).round().clamp(0, width - size).toInt(),
    y: (-top / scale).round().clamp(0, height - size).toInt(),
    size: size,
  );
}

Uint8List encodeAvatarCrop({
  required Uint8List rgba,
  required int width,
  required int height,
  required AvatarCrop crop,
}) {
  final original = image.Image.fromBytes(
    width: width,
    height: height,
    bytes: rgba.buffer,
    order: image.ChannelOrder.rgba,
  );
  final square = image.copyCrop(
    original,
    x: crop.x,
    y: crop.y,
    width: crop.size,
    height: crop.size,
  );
  final resized = image.copyResize(
    square,
    width: 512,
    height: 512,
    interpolation: image.Interpolation.cubic,
  );
  return image.encodeJpg(resized, quality: 85, chroma: image.JpegChroma.yuv420);
}
