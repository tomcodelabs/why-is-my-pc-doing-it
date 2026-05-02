use serde::Serialize;
use std::{thread, time::Duration};
use sysinfo::{Disks, System};

#[derive(Serialize)]
pub struct DashboardInfo {
    pub cpu_usage: f32,
    pub used_ram: u64,
    pub total_ram: u64,
    pub process_count: usize,
}

#[derive(Serialize)]
pub struct ProcessInfo {
    pub name: String,
    pub pid: u32,
    pub cpu_usage: f32,
    pub memory_mb: u64,
    pub executable_path: Option<String>,
}

#[derive(Serialize)]
pub struct StorageInfo {
    pub name: String,
    pub mount_point: String,
    pub total_space: u64,
    pub used_space: u64,
    pub free_space: u64,
    pub usage_percent: f32,
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

fn bytes_to_gb(value: u64) -> u64 {
    value / 1024 / 1024 / 1024
}

pub fn collect_dashboard_info() -> DashboardInfo {
    let system = collect_system_snapshot();

    DashboardInfo {
        cpu_usage: system.global_cpu_usage(),
        used_ram: bytes_to_mb(system.used_memory()),
        total_ram: bytes_to_mb(system.total_memory()),
        process_count: system.processes().len(),
    }
}

pub fn collect_processes() -> Vec<ProcessInfo> {
    let system = collect_system_snapshot();
    let mut processes = system
        .processes()
        .iter()
        .map(|(pid, process)| ProcessInfo {
            name: process.name().to_string_lossy().into_owned(),
            pid: pid.as_u32(),
            cpu_usage: process.cpu_usage(),
            memory_mb: bytes_to_mb(process.memory()),
            executable_path: process
                .exe()
                .map(|path| path.to_string_lossy().into_owned()),
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

pub fn collect_storage_info() -> Vec<StorageInfo> {
    let disks = Disks::new_with_refreshed_list();
    let mut storage = disks
        .iter()
        .map(|disk| {
            let total_space = bytes_to_gb(disk.total_space());
            let free_space = bytes_to_gb(disk.available_space());
            let used_space = total_space.saturating_sub(free_space);
            let usage_percent = if total_space == 0 {
                0.0
            } else {
                (used_space as f32 / total_space as f32) * 100.0
            };

            StorageInfo {
                name: disk.name().to_string_lossy().into_owned(),
                mount_point: disk.mount_point().to_string_lossy().into_owned(),
                total_space,
                used_space,
                free_space,
                usage_percent,
            }
        })
        .collect::<Vec<_>>();

    storage.sort_by(|a, b| a.mount_point.cmp(&b.mount_point));
    storage
}
