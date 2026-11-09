package com.atlas.app;

import android.app.Activity;
import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;
import androidx.core.app.NotificationManagerCompat;
import android.app.KeyguardManager;
import android.content.Intent;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import android.speech.RecognizerIntent;
import android.view.WindowManager;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

@CapacitorPlugin(name = "PersonalDevice", permissions = {
    @Permission(alias="notifications", strings={Manifest.permission.POST_NOTIFICATIONS})
})
public class PersonalDevicePlugin extends Plugin {
    private long authenticatedAt = 0;
    private CancellationSignal cancellation;
    private boolean authenticating = false;
    @PluginMethod public void requestNotifications(PluginCall call) {
        if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED)
            requestPermissionForAlias("notifications",call,"notificationResult");
        else notificationResult(call);
    }
    @PermissionCallback private void notificationResult(PluginCall call) {
        boolean granted=NotificationManagerCompat.from(getContext()).areNotificationsEnabled()
            && (Build.VERSION.SDK_INT<33 || ContextCompat.checkSelfPermission(getContext(),Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED);
        call.resolve(new JSObject().put("granted",granted));
    }
    private boolean secure() {
        KeyguardManager manager = (KeyguardManager) getContext().getSystemService(android.content.Context.KEYGUARD_SERVICE);
        return manager != null && manager.isDeviceSecure();
    }
    @PluginMethod public void status(PluginCall call) {
        String id = call.getString("userId", "");
        boolean enabled = getContext().getSharedPreferences("atlas_lock",0).getBoolean(id,false);
        getActivity().runOnUiThread(() -> {
            if (enabled) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve(new JSObject().put("available",secure()).put("enabled",enabled));
        });
    }
    @PluginMethod public void authenticate(PluginCall call) {
        if (!secure()) { call.reject("Atur kunci layar perangkat terlebih dahulu."); return; }
        if (authenticating) { call.reject("Pemeriksaan keamanan sedang berjalan."); return; }
        authenticating = true;
        getActivity().runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= 30) {
                cancellation = new CancellationSignal();
                new BiometricPrompt.Builder(getContext()).setTitle("Buka Atlas")
                    .setSubtitle("Konfirmasi dengan keamanan perangkatmu")
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                    .build().authenticate(cancellation,getContext().getMainExecutor(),new BiometricPrompt.AuthenticationCallback() {
                        @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            authenticatedAt = android.os.SystemClock.elapsedRealtime(); authenticating = false; call.resolve();
                        }
                        @Override public void onAuthenticationError(int code, CharSequence message) {
                            authenticating = false; call.reject("Atlas tetap terkunci. Coba buka kembali dengan keamanan perangkat.");
                        }
                    });
            } else {
                KeyguardManager manager = (KeyguardManager)getContext().getSystemService(android.content.Context.KEYGUARD_SERVICE);
                Intent intent = manager.createConfirmDeviceCredentialIntent("Buka Atlas","Konfirmasi kunci layar perangkatmu");
                if (intent == null) { authenticating = false; call.reject("Kunci layar belum tersedia."); return; }
                startActivityForResult(call,intent,"credentialResult");
            }
        });
    }
    @ActivityCallback private void credentialResult(PluginCall call, ActivityResult result) {
        authenticating = false;
        if (call == null) return;
        if (result.getResultCode() == Activity.RESULT_OK) { authenticatedAt=android.os.SystemClock.elapsedRealtime(); call.resolve(); }
        else call.reject("Atlas tetap terkunci.");
    }
    @PluginMethod public void setLock(PluginCall call) {
        String id=call.getString("userId","");
        if (id.isEmpty() || authenticatedAt == 0 || android.os.SystemClock.elapsedRealtime()-authenticatedAt > 30000) { call.reject("Konfirmasi keamanan perangkat sebelum mengubah kunci."); return; }
        boolean enabled=Boolean.TRUE.equals(call.getBoolean("enabled",false));
        if (!getContext().getSharedPreferences("atlas_lock",0).edit().putBoolean(id,enabled).commit()) { call.reject("Pengaturan kunci belum tersimpan."); return; }
        authenticatedAt = 0;
        status(call);
    }
    @PluginMethod public void dictate(PluginCall call) {
        Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"id-ID");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT,"Ucapkan catatanmu");
        try { startActivityForResult(call,intent,"speechResult"); }
        catch (RuntimeException error) { call.reject("Pengenalan suara belum tersedia. Gunakan keyboard."); }
    }
    @ActivityCallback private void speechResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        ArrayList<String> texts=result.getData()==null ? null : result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (result.getResultCode()==Activity.RESULT_OK && texts!=null && !texts.isEmpty()) call.resolve(new JSObject().put("text",texts.get(0)));
        else call.reject("Tidak ada suara yang disimpan.");
    }
    @PluginMethod public void saveBackup(PluginCall call) {
        String content=call.getString("content","");
        if (content.length()>4500000 || content.isEmpty()) { call.reject("Ukuran backup tidak didukung."); return; }
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE,call.getString("filename","Atlas-Backup.json"));
        try { startActivityForResult(call,intent,"backupResult"); }
        catch (RuntimeException error) { call.reject("Pemilih berkas belum tersedia."); }
    }
    @ActivityCallback private void backupResult(PluginCall call, ActivityResult result) {
        if (call==null) return;
        if (result.getResultCode()!=Activity.RESULT_OK || result.getData()==null || result.getData().getData()==null) { call.reject("Penyimpanan backup dibatalkan."); return; }
        try (OutputStream output=getContext().getContentResolver().openOutputStream(result.getData().getData())) {
            if(output==null)throw new IllegalStateException();
            output.write(call.getString("content","").getBytes(StandardCharsets.UTF_8));call.resolve();
        } catch(Exception error){call.reject("Backup belum berhasil disimpan.");}
    }
    @PluginMethod public void reminders(PluginCall call) {
        try {
            PersonalReminderReceiver.configure(getContext(),call.getString("userId",""),call.getArray("items"));call.resolve();
        } catch(Exception error) { call.reject("Pengingat aktivitas belum tersimpan."); }
    }
    @Override protected void handleOnDestroy() {
        if(cancellation!=null)cancellation.cancel();
        super.handleOnDestroy();
    }
}
