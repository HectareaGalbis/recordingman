package com.hectarea.recordingman;

import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private float inicioX;
    private float inicioY;
    private boolean sobreAnuncio = false;
    private boolean desviando = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        int modo = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        if (modo == Configuration.UI_MODE_NIGHT_YES && getBridge() != null) {
            getBridge().getWebView().setBackgroundColor(Color.parseColor("#161616"));
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        pantallaCompleta();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) pantallaCompleta();
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) {
        WebView web = getBridge() != null ? getBridge().getWebView() : null;
        if (web == null) return super.dispatchTouchEvent(ev);
        int accion = ev.getActionMasked();
        if (accion == MotionEvent.ACTION_DOWN) {
            inicioX = ev.getRawX();
            inicioY = ev.getRawY();
            sobreAnuncio = hayVistaEncima(web, ev.getRawX(), ev.getRawY());
            desviando = false;
        } else if (accion == MotionEvent.ACTION_MOVE && sobreAnuncio && !desviando) {
            float dx = Math.abs(ev.getRawX() - inicioX);
            float dy = Math.abs(ev.getRawY() - inicioY);
            if (dy > ViewConfiguration.get(this).getScaledTouchSlop() && dy > dx) {
                MotionEvent cancelar = MotionEvent.obtain(ev);
                cancelar.setAction(MotionEvent.ACTION_CANCEL);
                super.dispatchTouchEvent(cancelar);
                cancelar.recycle();
                int[] p = new int[2];
                web.getLocationOnScreen(p);
                MotionEvent abajo = MotionEvent.obtain(ev.getDownTime(), ev.getEventTime(), MotionEvent.ACTION_DOWN, inicioX - p[0], inicioY - p[1], 0);
                web.dispatchTouchEvent(abajo);
                abajo.recycle();
                desviando = true;
            }
        }
        if (desviando) {
            int[] p = new int[2];
            web.getLocationOnScreen(p);
            MotionEvent copia = MotionEvent.obtain(ev);
            copia.offsetLocation(ev.getRawX() - p[0] - ev.getX(), ev.getRawY() - p[1] - ev.getY());
            web.dispatchTouchEvent(copia);
            copia.recycle();
            if (accion == MotionEvent.ACTION_UP || accion == MotionEvent.ACTION_CANCEL) {
                desviando = false;
                sobreAnuncio = false;
            }
            return true;
        }
        return super.dispatchTouchEvent(ev);
    }

    private boolean hayVistaEncima(WebView web, float x, float y) {
        if (!(web.getParent() instanceof ViewGroup)) return false;
        ViewGroup padre = (ViewGroup) web.getParent();
        Rect r = new Rect();
        for (int i = padre.indexOfChild(web) + 1; i < padre.getChildCount(); i++) {
            View v = padre.getChildAt(i);
            if (v.getVisibility() == View.VISIBLE && v.getGlobalVisibleRect(r) && r.contains((int) x, (int) y)) return true;
        }
        return false;
    }

    private void pantallaCompleta() {
        Window ventana = getWindow();
        WindowInsetsControllerCompat control = WindowCompat.getInsetsController(ventana, ventana.getDecorView());
        control.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        control.hide(WindowInsetsCompat.Type.systemBars());
    }
}
