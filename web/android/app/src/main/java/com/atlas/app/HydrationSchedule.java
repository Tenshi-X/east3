package com.atlas.app;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.TimeZone;

/** Clock-based schedules, including active windows that cross midnight. */
public final class HydrationSchedule {
    private HydrationSchedule() {}

    public static boolean valid(int start, int end, int interval) {
        return start >= 0 && start < 1440 && end >= 0 && end < 1440 && start != end
            && (interval == 30 || interval == 60 || interval == 90 || interval == 120 || interval == 180);
    }

    public static boolean validWindows(long[][] windows, long from, long until) {
        if (from <= 0 || until <= from || until - from > 47L * 86400000 || windows.length > 200) return false;
        long previousEnd = Long.MIN_VALUE;
        for (long[] window : windows) {
            if (window.length != 2 || window[0] >= window[1] || window[1] > until || window[0] < previousEnd) return false;
            previousEnd = window[1];
        }
        return true;
    }

    public static long nextAutomatic(long[][] windows, long from, long until, int interval, long now) {
        if (!valid(0, 1, interval) || !validWindows(windows, from, until) || now >= until) return Long.MAX_VALUE;
        long step = interval * 60000L, after = Math.max(now, from - 1);
        for (long[] window : windows) {
            long at = window[0] + Math.max(0, Math.floorDiv(after - window[0], step) + 1) * step;
            if (at < window[1] && at < until) return at;
        }
        return Long.MAX_VALUE;
    }

    public static boolean automaticDue(long[][] windows, long from, long until, long due, long now, int interval) {
        if (!validWindows(windows, from, until) || now < from || now >= until || due > now || now - due >= interval * 60000L) return false;
        for (long[] window : windows)
            if (window[0] <= due && due < window[1] && window[0] <= now && now < window[1]) return true;
        return false;
    }

    public static List<Integer> slots(int start, int end, int interval) {
        if (!valid(start, end, interval)) throw new IllegalArgumentException("Jadwal minum tidak valid.");
        List<Integer> result = new ArrayList<>();
        int duration = (end - start + 1440) % 1440;
        for (int offset = 0; offset < duration; offset += interval) result.add((start + offset) % 1440);
        return result;
    }

    public static boolean isActive(int start, int end, long now, TimeZone zone) {
        Calendar clock = Calendar.getInstance(zone);
        clock.setTimeInMillis(now);
        int minute = clock.get(Calendar.HOUR_OF_DAY) * 60 + clock.get(Calendar.MINUTE);
        return start < end ? minute >= start && minute < end : minute >= start || minute < end;
    }

    public static long next(int start, int end, int interval, long now, TimeZone zone) {
        long next = Long.MAX_VALUE;
        for (int day = 0; day <= 2; day++) {
            for (int slot : slots(start, end, interval)) {
                Calendar clock = Calendar.getInstance(zone);
                clock.setTimeInMillis(now);
                clock.add(Calendar.DATE, day);
                clock.set(Calendar.HOUR_OF_DAY, slot / 60);
                clock.set(Calendar.MINUTE, slot % 60);
                clock.set(Calendar.SECOND, 0);
                clock.set(Calendar.MILLISECOND, 0);
                long candidate = clock.getTimeInMillis();
                if (candidate > now && candidate < next) next = candidate;
            }
        }
        return next;
    }
}
