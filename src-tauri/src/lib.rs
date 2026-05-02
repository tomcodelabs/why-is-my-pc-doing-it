mod system_data;

use system_data::{DashboardInfo, ProcessInfo, StorageInfo};

#[tauri::command]
fn get_dashboard_info() -> DashboardInfo {
    system_data::collect_dashboard_info()
}

#[tauri::command]
fn get_processes() -> Vec<ProcessInfo> {
    system_data::collect_processes()
}

#[tauri::command]
fn get_storage_info() -> Vec<StorageInfo> {
    system_data::collect_storage_info()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_dashboard_info,
            get_processes,
            get_storage_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
