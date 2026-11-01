package com.atlas.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONException;

/** One persistent system alarm; the receiver schedules the next occurrence. */
public final class HydrationAlarm {
    static final String ACTION = "com.atlas.app.HYDRATION_ALARM";
    static final String USER_EXTRA = "atlas_hydration_user";
    private static final String CHANNEL = "atlas_water";
    private static final int ID = 630001;

    private HydrationAlarm() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences("atlas_hydration", Context.MODE_PRIVATE);
    }

    static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Pengingat minum air", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Pengingat air putih sesuai jam aktif yang kamu pilih.");
            channel.enableVibration(true);
            context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    static boolean permitted(Context context) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) return false;
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = context.getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL);
            if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
        }
        return true;
    }

    private static PendingIntent alarmIntent(Context context) {
        Intent intent = new Intent(context, HydrationReceiver.class).setAction(ACTION);
        return PendingIntent.getBroadcast(context, ID, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void cancel(Context context) {
        context.getSystemService(AlarmManager.class).cancel(alarmIntent(context));
        NotificationManagerCompat.from(context).cancel(ID);
    }

    static long[][] windows(JSONArray values) throws JSONException {
        if (values == null || values.length() > 200) throw new JSONException("Invalid awake windows");
        long[][] result = new long[values.length()][2];
        for (int i = 0; i < values.length(); i++) {
            result[i][0] = values.getJSONObject(i).getLong("start");
            result[i][1] = values.getJSONObject(i).getLong("end");
        }
        return result;
    }

    private static long[][] savedWindows(SharedPreferences settings) {
        try { return windows(new JSONArray(settings.getString("windows", "[]"))); }
        catch (JSONException error) { return new long[0][2]; }
    }

    static void scheduleNext(Context context) {
        SharedPreferences settings = prefs(context);
        if (!settings.getBoolean("enabled", false) || !permitted(context)) {
            cancel(context);
            return;
        }
        int start = settings.getInt("start", 480), end = settings.getInt("end", 1320), interval = settings.getInt("interval", 120);
        if (!HydrationSchedule.valid(start, end, interval)) {
            cancel(context);
            return;
        }
        long next = settings.getBoolean("automatic", false)
            ? HydrationSchedule.nextAutomatic(savedWindows(settings), settings.getLong("validFrom", 0), settings.getLong("validUntil", 0), interval, System.currentTimeMillis())
            : HydrationSchedule.next(start, end, interval, System.currentTimeMillis(), TimeZone.getDefault());
        if (next == Long.MAX_VALUE) { cancel(context); return; }
        settings.edit().putLong("dueAt", next).apply();
        // Hydration tolerates a small delay. No exact-alarm special permission,
        // foreground service, network call, or running WebView is needed.
        context.getSystemService(AlarmManager.class).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarmIntent(context));
    }

    static void show(Context context, boolean test) {
        if (!permitted(context)) return;
        SharedPreferences settings = prefs(context);
        if (!test) {
            if (!settings.getBoolean("enabled", false)) return;
            long now = System.currentTimeMillis();
            if (settings.getBoolean("automatic", false)) {
                if (!HydrationSchedule.automaticDue(savedWindows(settings), settings.getLong("validFrom", 0), settings.getLong("validUntil", 0),
                    settings.getLong("dueAt", Long.MAX_VALUE), now, settings.getInt("interval", 120))) return;
            } else if (!HydrationSchedule.isActive(settings.getInt("start", 480), settings.getInt("end", 1320), now, TimeZone.getDefault())) return;
        }
        createChannel(context);
        Intent open = new Intent(context, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(USER_EXTRA, settings.getString("userId", ""));
        PendingIntent content = PendingIntent.getActivity(context, ID, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_water)
            .setColor(0xff088395)
            .setContentTitle(test ? "Pengingat minum air siap" : "Waktunya minum air putih")
            .setContentText(test ? "Notifikasi Atlas sudah diizinkan di HP ini." : "Sempatkan minum air putih. Ketuk untuk mencatat di Kebiasaan.")
            .setContentIntent(content)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        // Permission is checked above and may be revoked between that check
        // and notify; the receiver catches SecurityException and stops cleanly.
        if (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED) {
            NotificationManagerCompat.from(context).notify(ID, notification.build());
        }
    }
}
