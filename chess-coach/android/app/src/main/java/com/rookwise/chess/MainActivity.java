package com.rookwise.chess;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.Locale;

/**
 * The app runs in a WebView, but should not feel like a web page. This turns off what gives a WebView away
 * (the overscroll glow, scroll bars, pinch and double-tap zoom, the long-press text menu, the system font
 * scale changing the layout) and draws the app edge to edge behind transparent status and navigation bars,
 * like a native app. The bar sizes are handed to the page as CSS variables (see __rwInsets in index.html),
 * so the top bar and the bottom tab bar extend under the system bars on every Android version.
 */
public class MainActivity extends BridgeActivity {
    private static final int BACKGROUND = Color.rgb(0x2C, 0x2B, 0x28);
    private String insetsJs = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }
        // the app is dark: light status bar icons and a light gesture handle
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, window.getDecorView());
        bars.setAppearanceLightStatusBars(false);
        bars.setAppearanceLightNavigationBars(false);

        if (getBridge() == null) return;
        final WebView web = getBridge().getWebView();
        if (web == null) return;
        web.setBackgroundColor(BACKGROUND);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setHapticFeedbackEnabled(false);
        web.setLongClickable(false);
        web.setOnLongClickListener(v -> true);

        WebSettings settings = web.getSettings();
        settings.setTextZoom(100);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
            Insets sys = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            float d = getResources().getDisplayMetrics().density;
            insetsJs = String.format(Locale.US, "window.__rwInsets&&window.__rwInsets(%.1f,%.1f,%.1f,%.1f,%.1f)",
                sys.top / d, sys.right / d, sys.bottom / d, sys.left / d, Math.max(0, ime.bottom - sys.bottom) / d);
            web.evaluateJavascript(insetsJs, null);
            return WindowInsetsCompat.CONSUMED;
        });
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                if (insetsJs != null) webView.evaluateJavascript(insetsJs, null);
            }
        });
        ViewCompat.requestApplyInsets(web);
    }
}
