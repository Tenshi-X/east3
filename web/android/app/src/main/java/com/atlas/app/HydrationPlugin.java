package com.atlas.app;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;
import org.json.JSONException;

@CapacitorPlugin(name = "HydrationReminders", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class HydrationPlugin extends Plugin {
    @Override
    public void load() {
        HydrationAlarm.createChannel(getContext());
        opened(getActivity().getIntent());
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        call.resolve(new JSObject().put("granted", HydrationAlarm.permitted(getContext())));
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED)
            requestPermissionForAlias("notifications", call, "permissionResult");
        else checkPermission(call);
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) { checkPermission(call); }

    @PluginMethod
    public void configure(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        String userId = call.getString("userId", "");
        int start = call.getInt("startMinute", 480), end = call.getInt("endMinute", 1320), interval = call.getInt("interval", 120);
        boolean automatic = Boolean.TRUE.equals(call.getBoolean("automatic", false));
        JSONArray windows = call.getArray("windows");
        long from = call.getLong("validFrom", 0L), until = call.getLong("validUntil", 0L);
        if (enabled && (userId.isEmpty() || !HydrationSchedule.valid(start, end, interval))) {
            call.reject("Jadwal minum tidak valid.");
            return;
        }
        if (enabled && !HydrationAlarm.permitted(getContext())) {
            call.reject("Izinkan notifikasi Atlas di Pengaturan HP, lalu coba aktifkan lagi.");
            return;
        }
        try {
            if (enabled && automatic && (!HydrationSchedule.validWindows(HydrationAlarm.windows(windows), from, until) || until <= System.currentTimeMillis())) {
                call.reject("Jadwal otomatis belum tersedia. Buka Atlas untuk menyinkronkan ulang.");
                return;
            }
            HydrationAlarm.cancel(getContext());
            boolean saved = HydrationAlarm.prefs(getContext()).edit().putBoolean("enabled", enabled)
                .putString("userId", userId).putInt("start", start).putInt("end", end).putInt("interval", interval)
                .putBoolean("automatic", automatic).putString("windows", windows == null ? "[]" : windows.toString())
                .putLong("validFrom", from).putLong("validUntil", until).commit();
            if (!saved) throw new IllegalStateException("Pengaturan pengingat belum tersimpan.");
            HydrationAlarm.scheduleNext(getContext());
            call.resolve();
        } catch (RuntimeException | JSONException error) {
            HydrationAlarm.prefs(getContext()).edit().putBoolean("enabled", false).apply();
            call.reject("Pengingat belum berhasil dijadwalkan. Coba simpan lagi.", error);
        }
    }

    @PluginMethod
    public void testNotification(PluginCall call) {
        try {
            if (!HydrationAlarm.permitted(getContext())) {
                call.reject("Izinkan notifikasi Atlas di Pengaturan HP terlebih dahulu.");
                return;
            }
            HydrationAlarm.show(getContext(), true);
            call.resolve();
        } catch (RuntimeException error) {
            call.reject("Notifikasi percobaan belum terkirim.", error);
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) { opened(intent); }

    private void opened(Intent intent) {
        if (intent != null && intent.hasExtra(HydrationAlarm.USER_EXTRA)) {
            String userId = intent.getStringExtra(HydrationAlarm.USER_EXTRA);
            intent.removeExtra(HydrationAlarm.USER_EXTRA);
            notifyListeners("notificationOpened", new JSObject().put("userId", userId), true);
        }
    }
}
