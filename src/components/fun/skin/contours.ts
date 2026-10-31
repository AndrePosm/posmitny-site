/** Ordered MediaPipe face-mesh loops. Person’s left is the image-right eye when they face the camera. */

export const FACE_OVAL = [
  297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10, 338,
] as const;

/** Outer lip. The inner loop sits inside this one. */
export const LIPS = [
  270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61, 185, 40, 39, 37, 0, 267, 269,
] as const;

export const LEFT_EYE = [
  374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373,
] as const;

export const RIGHT_EYE = [
  154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33, 7, 163, 144, 145, 153,
] as const;

export const LEFT_IRIS = [476, 477, 474, 475] as const;
export const RIGHT_IRIS = [469, 470, 471, 472] as const;

/** Each brow is two arcs. They are stroked, not filled. */
export const LEFT_BROW = [
  [336, 296, 334, 293, 300],
  [276, 283, 282, 295, 285],
] as const;

export const RIGHT_BROW = [
  [46, 53, 52, 65, 55],
  [70, 63, 105, 66, 107],
] as const;

/** Nostril wings on the face-mesh nose contour. */
export const NOSTRIL = [98, 327] as const;
