# Soccer Symphony

## Purpose
This project is an interactive web application that turns soccer match video footage into real-time music. It uses artificial intelligence to analyze video clips of soccer games, track the movement of players on the field, and use their collective speed to control a musical synthesizer. When the game speeds up, the music speeds up, creating a changing soundtrack composed by the movement of the athletes.

## How It Works
The system splits the work into two main processes to keep the application running smoothly in the browser:

* **Visual Tracking:** The application loads a YOLOv8 machine learning model inside a separate background process called a Web Worker. This background thread calculates the positions of all players on the screen, finds their average center-point, and monitors how fast that center-point shifts without freezing the user interface.
* **Algorithmic Audio Engine:** The app uses Tone.js to generate audio. To prevent the music from sounding like a repetitive scale, the engine uses a math-based random walk. It holds pools of matching notes grouped by different chords and randomly selects a nearby note from the active chord group on each beat, creating a continuous, non-repetitive melody.

## Key Technical Features
* **Time Normalization:** Velocity is calculated by dividing the distance players moved by the exact number of milliseconds that passed between tracking frames. This keeps the tempo stable regardless of computer performance or frame drops.
* **Camera Pan Filtering:** Sudden stadium camera movements can trick the AI into reading impossible player speeds. The code contains a spatial gate that completely ignores sudden tracking jumps larger than 120 pixels to keep the music steady during quick camera cuts.
* **Exponential Damping:** To prevent the music from shifting erratically between fast and slow speeds, the app applies a digital shock absorber. It blends 93% of the previous tempo with 7% of the new speed calculation, ensuring all musical transitions are smooth and gradual.