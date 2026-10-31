package io.github.nitaysc.redeclipse;

import org.libsdl.app.SDLActivity;

/** Runs the game engine (libmain.so) through SDL. */
public class GameActivity extends SDLActivity {
    @Override
    protected String[] getLibraries() {
        return new String[] { "c++_shared", "SDL2", "main" };
    }

    @Override
    protected String[] getArguments() {
        // keep settings, saves and logs next to the unpacked game, inside the app's private storage
        return new String[] { "-h" + getFilesDir().getAbsolutePath() + "/home" };
    }
}
