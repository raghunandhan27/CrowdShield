import cv2
import numpy as np
import os
import math

def generate_risk_video(filename, zone_name, zone_code, num_pedestrians, risk_level, speed_factor=1.0, seed=42):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    fps = 30.0
    width, height = 640, 480
    out = cv2.VideoWriter(filename, fourcc, fps, (width, height))
    
    np.random.seed(seed)
    
    # Trapezoid bounds for perspective zone
    # [140, 130], [500, 130], [620, 460], [20, 460]
    poly_pts = np.array([[140, 130], [500, 130], [620, 460], [20, 460]], np.int32)
    
    # Initialize pedestrians
    pedestrians = []
    for i in range(num_pedestrians):
        # Sample points biased towards inside the trapezoid
        y = np.random.uniform(140, 450)
        # Interpolate x bounds based on y
        t = (y - 130) / (460 - 130)
        x_min = 140 + t * (20 - 140) + 15
        x_max = 500 + t * (620 - 500) - 15
        x = np.random.uniform(x_min, x_max)
        
        # Velocity
        angle = np.random.uniform(0, 2 * math.pi)
        spd = np.random.uniform(0.6, 1.8) * speed_factor
        vx = spd * math.cos(angle)
        vy = spd * math.sin(angle) * 0.6 # less vertical speed for perspective
        
        pedestrians.append({
            'x': x, 'y': y, 'vx': vx, 'vy': vy,
            'phase': np.random.uniform(0, 2 * math.pi)
        })
        
    for frame_idx in range(150): # 5 second seamless loop
        frame = np.full((height, width, 3), 36, dtype=np.uint8) # Dark CAD floor
        
        # Grid lines
        for gx in range(0, width, 32):
            cv2.line(frame, (gx, 0), (gx, height), (50, 52, 50), 1)
        for gy in range(0, height, 32):
            cv2.line(frame, (0, gy), (width, gy), (50, 52, 50), 1)
            
        # Draw yellow calibrated perspective polygon
        cv2.polylines(frame, [poly_pts.reshape((-1, 1, 2))], isClosed=True, color=(35, 205, 245), thickness=2, lineType=cv2.LINE_AA)
        
        # Draw Zone Name Label Pill at top-left of zone
        label_text = f"{zone_name}"
        (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
        cv2.rectangle(frame, (40, 35), (40 + tw + 18, 35 + th + 14), (20, 20, 20), -1)
        cv2.rectangle(frame, (40, 35), (40 + tw + 18, 35 + th + 14), (60, 60, 60), 1)
        cv2.putText(frame, label_text, (48, 35 + th + 7), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (220, 220, 220), 1, cv2.LINE_AA)
        
        # Sort pedestrians by Y coordinate for proper depth layering (render back-to-front)
        pedestrians.sort(key=lambda p: p['y'])
        
        for p in pedestrians:
            # Update position
            p['x'] += p['vx']
            p['y'] += p['vy']
            
            # Boundary check within perspective area
            y = p['y']
            if y < 140:
                p['y'] = 140
                p['vy'] *= -1
            elif y > 450:
                p['y'] = 450
                p['vy'] *= -1
                
            t = (p['y'] - 130) / (460 - 130)
            x_min = 140 + t * (20 - 140) + 10
            x_max = 500 + t * (620 - 500) - 10
            if p['x'] < x_min:
                p['x'] = x_min
                p['vx'] *= -1
            elif p['x'] > x_max:
                p['x'] = x_max
                p['vx'] *= -1
                
            px, py = int(p['x']), int(p['y'])
            
            # Perspective scaling factor
            scale = 0.65 + 0.55 * t # 0.65 at top, 1.20 at bottom
            head_r = int(9 * scale)
            body_w = int(10 * scale)
            body_h = int(24 * scale)
            leg_h = int(15 * scale)
            
            # Walking leg oscillation
            walk_anim = math.sin(frame_idx * 0.35 + p['phase']) * (4 * scale)
            
            # 1. Legs (dark brown)
            leg_color = (45, 65, 95)
            cv2.line(frame, (px - int(4*scale), py), (px - int(4*scale) + int(walk_anim), py + leg_h), leg_color, max(1, int(2.5*scale)), cv2.LINE_AA)
            cv2.line(frame, (px + int(4*scale), py), (px + int(4*scale) - int(walk_anim), py + leg_h), leg_color, max(1, int(2.5*scale)), cv2.LINE_AA)
            
            # 2. Torso (warm brown)
            torso_color = (65, 95, 145)
            cv2.rectangle(frame, (px - body_w, py - body_h), (px + body_w, py), torso_color, -1)
            
            # 3. Head (light cyan/blue - exact head dot target for P2PNet/CSRNet)
            head_color = (215, 195, 160)
            head_cy = py - body_h - head_r + 2
            cv2.circle(frame, (px, head_cy), head_r, head_color, -1, lineType=cv2.LINE_AA)
            
        out.write(frame)
        
    out.release()
    print(f"Generated {filename} ({num_pedestrians} pax, Risk: {risk_level}) -> Size: {os.path.getsize(filename)} bytes")

if __name__ == "__main__":
    # 1. Zone A - Low Risk (12 people)
    generate_risk_video(r"D:\crowdshield\test_videos\cam1_plaza.mp4", "Zone A - Main Gate Plaza", "z1", 12, "LOW_SAFE", speed_factor=1.2, seed=101)
    # 2. Zone B - Medium Risk (36 people)
    generate_risk_video(r"D:\crowdshield\test_videos\cam2_choke.mp4", "Zone B - East Corridor Choke", "z2", 36, "MEDIUM_CAUTION", speed_factor=0.8, seed=202)
    # 3. Zone C - Very High Risk (96 people)
    generate_risk_video(r"D:\crowdshield\test_videos\cam3_aerial.mp4", "Zone C - Central Stage Arena", "z3", 96, "VERY_HIGH_CRITICAL", speed_factor=0.35, seed=303)
    # 4. Zone D - Safe Exit Approach (14 people)
    generate_risk_video(r"D:\crowdshield\test_videos\cam4_approach.mp4", "Zone D - North Exit Concourse", "z4", 14, "LOW_SAFE", speed_factor=1.1, seed=404)
