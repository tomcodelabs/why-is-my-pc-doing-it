use serde::Serialize;
use std::{thread, time::Duration};
use sysinfo::System;

#[derive(Serialize)]
struct DashboardInfo {
    cpu_usage: f32,
    used_ram: u64,
    total_ram: u64,
    process_count: usize,
}

#[derive(Serialize)]
struct ProcessInfo {
    name: String,
    pid: u32,
    cpu_usage: f32,
    memory_mb: u64,
}

fn collect_system_snapshot() -> System {
    let mut system = System::new_all();
    thread::sleep(Duration::from_millis(200));
    system.refresh_all();
    system
}

fn bytes_to_mb(value: u64) -> u64 {
    value / 1024 / 1024
}

#[tauri::command]
fn get_dashboard_info() -> DashboardInfo {
    let system = collect_system_snapshot();

    DashboardInfo {
        cpu_usage: system.global_cpu_usage(),
        used_ram: bytes_to_mb(system.used_memory()),
        total_ram: bytes_to_mb(system.total_memory()),
        process_count: system.processes().len(),
    }
}

#[tauri::command]
fn get_processes() -> Vec<ProcessInfo> {
    let system = collect_system_snapshot();
    let mut processes = system
        .processes()
        .iter()
        .map(|(pid, process)| ProcessInfo {
            name: process.name().to_string_lossy().into_owned(),
            pid: pid.as_u32(),
            cpu_usage: process.cpu_usage(),
            memory_mb: bytes_to_mb(process.memory()),
        })
        .collect::<Vec<_>>();

    processes.sort_by(|a, b| {
        b.cpu_usage
            .partial_cmp(&a.cpu_usage)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| b.memory_mb.cmp(&a.memory_mb))
            .then_with(|| a.name.cmp(&b.name))
    });

    processes
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_dashboard_info,
            get_processes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
