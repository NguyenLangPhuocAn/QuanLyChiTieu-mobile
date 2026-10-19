package vn.codex.banktest;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public final class NotificationFixtureReceiver extends BroadcastReceiver {
    private static final String CHANNEL_ID = "bank-transactions";

    @Override
    public void onReceive(Context context, Intent intent) {
        String title = intent.getStringExtra("title");
        String text = intent.getStringExtra("text");
        int id = intent.getIntExtra("id", (int) (System.currentTimeMillis() & 0x7fffffff));
        if (title == null) title = "Bien dong so du";
        if (text == null) text = "Giao dich -10.000 VND. So du 1.000.000 VND";

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(new NotificationChannel(
                CHANNEL_ID,
                "Giao dịch thử nghiệm",
                NotificationManager.IMPORTANCE_HIGH
            ));
        }

        manager.notify(id, new android.app.Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_more)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new android.app.Notification.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .build());
    }
}
