import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as image;
import 'package:nodra/core/avatar_crop.dart';

void main() {
  test('the circular preview maps to a centered square source crop', () {
    final center = avatarCropRect(
      width: 100,
      height: 50,
      viewport: 200,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    );
    expect((center.x, center.y, center.size), (25, 0, 50));

    final moved = avatarCropRect(
      width: 100,
      height: 50,
      viewport: 200,
      zoom: 1,
      offsetX: 50,
      offsetY: 0,
    );
    expect((moved.x, moved.y, moved.size), (13, 0, 50));
    expect(clampAvatarOffset(500, 100, 200, 1, 4), 100);
  });

  test('exports a 512-pixel JPEG accepted by the avatar endpoint', () {
    final rgba = Uint8List.fromList(
      List<int>.generate(80 * 80 * 4, (index) => index % 4 == 3 ? 255 : 95),
    );
    final bytes = encodeAvatarCrop(
      rgba: rgba,
      width: 80,
      height: 80,
      crop: const AvatarCrop(x: 0, y: 0, size: 80),
    );
    final decoded = image.decodeJpg(bytes);
    expect(decoded, isNotNull);
    expect((decoded!.width, decoded.height), (512, 512));
    expect(bytes.length, lessThan(512 * 1024));
  });
}
