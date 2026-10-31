package io.github.nitaysc.redeclipse;

import android.app.Activity;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Unpacks the game data (assets/game.zip) into private storage the first time the app
 * runs, or after an update, then starts the game.
 */
public class InstallActivity extends Activity {
    private TextView status;
    private ProgressBar bar;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        File gameDir = new File(getFilesDir(), "game");
        File marker = new File(gameDir, ".installed-" + BuildConfig.VERSION_CODE);
        if (marker.exists()) {
            startGame();
            return;
        }

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.rgb(20, 4, 8));
        layout.setPadding(80, 80, 80, 80);
        TextView title = new TextView(this);
        title.setText("RED ECLIPSE");
        title.setTextColor(Color.rgb(230, 40, 40));
        title.setTextSize(34);
        title.setGravity(Gravity.CENTER);
        status = new TextView(this);
        status.setText("Preparing game files…");
        status.setTextColor(Color.LTGRAY);
        status.setTextSize(16);
        status.setGravity(Gravity.CENTER);
        status.setPadding(0, 30, 0, 30);
        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(1000);
        layout.addView(title);
        layout.addView(status);
        layout.addView(bar, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        setContentView(layout);

        new Thread(() -> {
            try {
                install(gameDir, marker);
                runOnUiThread(this::startGame);
            } catch (IOException e) {
                runOnUiThread(() -> status.setText("Could not unpack the game files:\n" + e.getMessage()
                        + "\n\nMake sure the phone has about 2 GB of free space, then reopen the app."));
            }
        }).start();
    }

    private void install(File gameDir, File marker) throws IOException {
        deleteTree(gameDir);
        if (!gameDir.mkdirs()) throw new IOException("cannot create " + gameDir);
        long total;
        try (AssetFileDescriptor fd = getAssets().openFd("game.zip")) {
            total = fd.getLength();
        }
        final long size = total;
        final long[] done = { 0 };
        byte[] buf = new byte[1 << 16];
        String root = gameDir.getCanonicalPath() + File.separator;
        try (InputStream raw = getAssets().open("game.zip");
             InputStream counted = new FilterInputStream(new BufferedInputStream(raw, 1 << 16)) {
                 @Override public int read(byte[] b, int off, int len) throws IOException {
                     int n = super.read(b, off, len);
                     if (n > 0) done[0] += n;
                     return n;
                 }
             };
             ZipInputStream zip = new ZipInputStream(counted)) {
            ZipEntry e;
            long lastUi = 0;
            while ((e = zip.getNextEntry()) != null) {
                File out = new File(gameDir, e.getName());
                if (!out.getCanonicalPath().startsWith(root)) throw new IOException("bad entry " + e.getName());
                if (e.isDirectory()) { out.mkdirs(); continue; }
                File parent = out.getParentFile();
                if (parent != null) parent.mkdirs();
                try (OutputStream os = new FileOutputStream(out)) {
                    int n;
                    while ((n = zip.read(buf)) > 0) os.write(buf, 0, n);
                }
                long now = System.currentTimeMillis();
                if (now - lastUi > 100) {
                    lastUi = now;
                    final int permille = (int) (done[0] * 1000 / Math.max(1, size));
                    runOnUiThread(() -> {
                        bar.setProgress(permille);
                        status.setText("Unpacking game files… " + permille / 10 + "%\n(only on first launch)");
                    });
                }
            }
        }
        new File(getFilesDir(), "home").mkdirs();
        if (!marker.createNewFile()) throw new IOException("cannot write " + marker);
    }

    private static void deleteTree(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        f.delete();
    }

    private void startGame() {
        startActivity(new Intent(this, GameActivity.class));
        finish();
    }
}
