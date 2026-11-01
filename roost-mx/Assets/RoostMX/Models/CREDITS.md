# Third-party models

## Motorcycle: `Bike/RoostBike450.glb`
Based on **"KTM Dirt Bike"** by **OCTbuilds**
(https://sketchfab.com/3d-models/ktm-dirt-bike-e31415580d7a4a0d95ebd53895566b8f),
licensed under **CC-BY-4.0** (http://creativecommons.org/licenses/by/4.0/).
Changes: split into animatable parts (frame, steering, fork lowers, wheels, swingarm), front
end straightened, kickstand removed, manufacturer lettering removed from the graphics,
textures downscaled. Done by `tools/models/prepare_bike.py`. The credit above must be shown
in the game (credits screen) and wherever the game is distributed.

## Rider: `Rider/RoostRider.fbx`
"Fire_Male_01" from the **Microsoft Rocketbox Avatar Library**
(https://github.com/microsoft/Microsoft-Rocketbox), **MIT License** (see
`Rider/LICENSE-Microsoft-Rocketbox-MIT.md`). Fully rigged (Bip01 skeleton, 80+ bones,
maps to Unity Humanoid). Textures recoloured into a motocross kit by
`tools/models/recolor_rider.py`.
