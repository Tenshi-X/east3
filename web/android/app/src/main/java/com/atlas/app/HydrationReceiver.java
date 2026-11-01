package com.atlas.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class HydrationReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            if (HydrationAlarm.ACTION.equals(intent.getAction())) HydrationAlarm.show(context, false);
        } catch (SecurityException error) {
            Log.w("AtlasHydration", "Notification permission was revoked.", error);
        } finally {
            try {
                // Also restores alarms after reboot, app update, and clock or
                // timezone changes. It never emits a catch-up notification.
                HydrationAlarm.scheduleNext(context);
            } catch (RuntimeException error) {
                Log.w("AtlasHydration", "Unable to schedule hydration reminder.", error);
            }
        }
    }
}
