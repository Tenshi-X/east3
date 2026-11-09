package com.atlas.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONObject;

public class PersonalReminderReceiver extends BroadcastReceiver {
    private static final int ID=630002;
    private static final String ACTION="com.atlas.app.PERSONAL_REMINDER";
    private static final String CHANNEL="atlas_activities";
    private static SharedPreferences prefs(Context c){return c.getSharedPreferences("atlas_personal_reminders",0);}
    private static boolean permitted(Context c){
        if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(c,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return false;
        if(!NotificationManagerCompat.from(c).areNotificationsEnabled())return false;
        if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=c.getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL);if(channel!=null&&channel.getImportance()==NotificationManager.IMPORTANCE_NONE)return false;}
        return true;
    }
    private static PendingIntent alarm(Context c){return PendingIntent.getBroadcast(c,ID,new Intent(c,PersonalReminderReceiver.class).setAction(ACTION),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    static void configure(Context c,String userId,JSONArray items)throws Exception{
        if(items==null||items.length()>200)throw new IllegalArgumentException();
        for(int i=0;i<items.length();i++){
            JSONObject row=items.getJSONObject(i);
            if(row.getString("title").length()>600 || row.getLong("expires")<=row.getLong("at"))throw new IllegalArgumentException();
        }
        if(!prefs(c).edit().putString("userId",userId).putString("items",items.toString()).commit())throw new IllegalStateException();
        NotificationManagerCompat.from(c).cancel(ID);schedule(c);
    }
    private static JSONObject next(Context c,long after)throws Exception{
        JSONArray rows=new JSONArray(prefs(c).getString("items","[]"));JSONObject next=null;
        for(int i=0;i<rows.length();i++){
            JSONObject row=rows.getJSONObject(i);
            if(row.getLong("at")>after && (next==null || row.getLong("at")<next.getLong("at")))next=row;
        }
        return next;
    }
    private static void schedule(Context c)throws Exception{
        AlarmManager manager=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);manager.cancel(alarm(c));
        if(prefs(c).getString("userId","").isEmpty()||!permitted(c))return;
        JSONObject row=next(c,System.currentTimeMillis());
        if(row==null)return;
        prefs(c).edit().putString("due",row.toString()).apply();
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,row.getLong("at"),alarm(c));
    }
    @Override public void onReceive(Context c,Intent intent){
        try{
            if(ACTION.equals(intent.getAction())&&!prefs(c).getString("userId","").isEmpty()&&permitted(c)){
                JSONObject row=new JSONObject(prefs(c).getString("due","{}"));long now=System.currentTimeMillis();
                if(now>=row.getLong("at")&&now<Math.min(row.getLong("expires"),row.getLong("at")+10*60000L)){
                    if(Build.VERSION.SDK_INT>=26)c.getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL,"Pengingat aktivitas",NotificationManager.IMPORTANCE_DEFAULT));
                    Intent open=new Intent(c,MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    PendingIntent content=PendingIntent.getActivity(c,ID,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
                    // Lock-screen previews omit the activity title because Atlas contains personal data.
                    NotificationCompat.Builder notification=new NotificationCompat.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_stat_water)
                        .setContentTitle("Ada aktivitas dalam rencanamu").setContentText("Buka Atlas untuk memeriksa dan mencatat aktivitas.")
                        .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setContentIntent(content).setAutoCancel(true).setCategory(NotificationCompat.CATEGORY_REMINDER);
                    NotificationManagerCompat.from(c).notify(ID,notification.build());
                }
            }
        }catch(Exception ignored){/* Expired or invalid reminders must not be delivered. */}
        finally{try{schedule(c);}catch(Exception ignored){/* Retry after the next application sync. */}}
    }
}
