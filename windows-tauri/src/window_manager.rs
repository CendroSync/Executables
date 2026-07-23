use tauri::{AppHandle, Manager, PhysicalPosition, Position};

pub fn show_micro_window(app_handle: &AppHandle, preview_text: &str) -> Result<(), String> {
    if let Some(popup_window) = app_handle.get_webview_window("popup") {
        // Safely escape string for JS evaluation
        let escaped_text = preview_text.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', " ");
        let js = format!("if (window.setPreviewText) window.setPreviewText(\"{}\");", escaped_text);
        let _ = popup_window.eval(&js);

        // Calculate bottom-right screen position
        if let Ok(Some(monitor)) = popup_window.primary_monitor() {
            let monitor_size = monitor.size();
            let scale_factor = monitor.scale_factor();
            let window_width = (340.0 * scale_factor) as i32;
            let window_height = (130.0 * scale_factor) as i32;
            let padding = (20.0 * scale_factor) as i32;

            let x = (monitor_size.width as i32) - window_width - padding;
            let y = (monitor_size.height as i32) - window_height - padding - (40 * scale_factor as i32);

            let _ = popup_window.set_position(Position::Physical(PhysicalPosition { x, y }));
        }

        let _ = popup_window.unminimize();
        let _ = popup_window.set_always_on_top(true);
        let _ = popup_window.show();
        println!("[WindowManager] Displayed micro-window popup!");
    } else {
        eprintln!("[WindowManager Error] 'popup' window not found!");
    }
    Ok(())
}

pub fn hide_micro_window(app_handle: &AppHandle) {
    if let Some(popup_window) = app_handle.get_webview_window("popup") {
        let _ = popup_window.hide();
    }
}

pub fn show_main_window(app_handle: &AppHandle) {
    if let Some(main_window) = app_handle.get_webview_window("main") {
        let _ = main_window.unminimize();
        let _ = main_window.show();
        let _ = main_window.set_focus();
    }
}


