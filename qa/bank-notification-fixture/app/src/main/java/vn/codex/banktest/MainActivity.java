package vn.codex.banktest;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.widget.TextView;

public final class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        TextView message = new TextView(this);
        message.setText("Ngân hàng thử nghiệm\n\nỨng dụng QA dùng để phát thông báo kiểm thử cho Sổ Thu Chi Nova.");
        message.setTextSize(18);
        message.setPadding(48, 96, 48, 48);
        setContentView(message);

        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 100);
        }
    }
}
