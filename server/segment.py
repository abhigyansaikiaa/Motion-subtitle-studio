import sys
import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import os

def extract_mask(input_video, output_mask):
    base_options = python.BaseOptions(model_asset_path='selfie_segmenter.tflite')
    options = vision.ImageSegmenterOptions(base_options=base_options,
                                         output_category_mask=True)
    segmenter = vision.ImageSegmenter.create_from_options(options)
    
    cap = cv2.VideoCapture(input_video)
    if not cap.isOpened():
        print(f"Error: Cannot open video {input_video}")
        sys.exit(1)
        
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps    = cap.get(cv2.CAP_PROP_FPS)
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_mask, fourcc, fps, (width, height), isColor=False)
    
    while cap.isOpened():
        success, image = cap.read()
        if not success:
            break
            
        # Convert the BGR image to RGB
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
        segmentation_result = segmenter.segment(mp_image)
        
        category_mask = segmentation_result.category_mask.numpy_view()
        
        # Selfie segmenter model: 0 is background, 255 is person usually or depending on model,
        # In this TFLite model, the category map typically has background as 0 and person as 1 or 255.
        # It's usually 0 (background) and 1 (person), let's check > 0
        mask_frame = np.where(category_mask > 0, 255, 0).astype(np.uint8)
        
        out.write(mask_frame)
            
    cap.release()
    out.release()
    print("Done generating mask.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python segment.py <input_video> <output_mask>")
        sys.exit(1)
        
    extract_mask(sys.argv[1], sys.argv[2])
