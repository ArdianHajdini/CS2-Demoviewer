use serde::Serialize;
use serde_json::Value;
use std::{fs, fs::File, io, path::{Path, PathBuf}, process::Stdio, time::Duration};
use tauri::Manager;
use tokio::{process::Command, time::timeout};

#[derive(Serialize)]
struct DemoFile {
    filepath: String,
    filename: String,
    size_bytes: u64,
    modified_at: String,
}

#[tauri::command]
fn list_demos(directory: String) -> Result<Vec<DemoFile>, String> {
    let entries = fs::read_dir(&directory).map_err(|error| error.to_string())?;
    let mut demos = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !is_demo_file(&path) { continue; }
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        demos.push(DemoFile {
            filepath: path.to_string_lossy().to_string(),
            filename: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
            size_bytes: metadata.len(),
            modified_at: metadata.modified().ok().and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok()).map(|duration| duration.as_secs().to_string()).unwrap_or_default(),
        });
    }
    Ok(demos)
}

#[tauri::command]
fn import_demo(source_path: String, destination_directory: String) -> Result<String, String> {
    fs::create_dir_all(&destination_directory).map_err(|error| error.to_string())?;
    let source = PathBuf::from(&source_path);
    if !is_demo_file(&source) { return Err("Only .dem, .dem.gz and .dem.zst files are supported".into()); }
    let source_name = source.file_name().ok_or("Invalid source filename")?.to_string_lossy().to_string();
    let destination_name = source_name.strip_suffix(".gz").or_else(|| source_name.strip_suffix(".zst")).unwrap_or(&source_name);
    let destination = PathBuf::from(destination_directory).join(destination_name);
    if source_name.to_lowercase().ends_with(".dem.gz") {
        let input = File::open(&source).map_err(|error| error.to_string())?;
        let mut decoder = flate2::read::GzDecoder::new(input);
        let mut output = File::create(&destination).map_err(|error| error.to_string())?;
        io::copy(&mut decoder, &mut output).map_err(|error| error.to_string())?;
    } else if source_name.to_lowercase().ends_with(".dem.zst") {
        let input = File::open(&source).map_err(|error| error.to_string())?;
        let mut decoder = zstd::stream::read::Decoder::new(input).map_err(|error| error.to_string())?;
        let mut output = File::create(&destination).map_err(|error| error.to_string())?;
        io::copy(&mut decoder, &mut output).map_err(|error| error.to_string())?;
    } else {
        fs::copy(&source, &destination).map_err(|error| error.to_string())?;
    }
    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_demo(filepath: String) -> Result<(), String> {
    fs::remove_file(filepath).map_err(|error| error.to_string())
}

#[tauri::command]
fn rename_demo(filepath: String, new_name: String) -> Result<String, String> {
    let source = PathBuf::from(filepath);
    let destination = source.parent().ok_or("Demo has no parent directory")?.join(new_name);
    fs::rename(&source, &destination).map_err(|error| error.to_string())?;
    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    std::process::Command::new("explorer").arg(path).spawn().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn detect_downloads_folder() -> Result<String, String> {
    let profile = std::env::var("USERPROFILE").map_err(|error| error.to_string())?;
    Ok(PathBuf::from(profile).join("Downloads").to_string_lossy().to_string())
}

#[tauri::command]
fn detect_replay_folder() -> Result<Option<String>, String> {
    let candidates = [
        r"C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\replays",
        r"C:\Program Files\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\replays",
        r"D:\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\replays",
        r"E:\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\replays",
    ];
    Ok(candidates.iter().map(PathBuf::from).find(|path| path.exists()).map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
fn copy_to_clipboard(command: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|error| error.to_string())?;
    clipboard.set_text(command).map_err(|error| error.to_string())
}

#[tauri::command]
async fn run_demo_analyzer(app: tauri::AppHandle, filepath: String) -> Result<Value, String> {
    let analyzer = find_analyzer(&app)?;
    let node_runtime = find_node_runtime(&analyzer);
    let mut command = Command::new(node_runtime);
    if let Some(parent) = analyzer.parent() {
        command.current_dir(parent);
    }
    let child = command
        .arg(&analyzer)
        .arg(filepath)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Failed to start local analyzer: {error}"))?;
    let output = timeout(Duration::from_secs(120), child.wait_with_output())
        .await
        .map_err(|_| "Analyzer timed out after 120 seconds".to_string())?
        .map_err(|error| error.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let json: Value = serde_json::from_str(stdout.trim()).map_err(|error| format!("Analyzer returned invalid JSON: {error}. stderr: {stderr}"))?;
    Ok(json)
}

#[tauri::command]
fn export_stats_debug(filepath: String, json: Value) -> Result<(), String> {
    let content = serde_json::to_string_pretty(&json).map_err(|error| error.to_string())?;
    fs::write(filepath, content).map_err(|error| error.to_string())
}

fn is_demo_file(path: &Path) -> bool {
    let name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
    name.ends_with(".dem") || name.ends_with(".dem.gz") || name.ends_with(".dem.zst")
}

fn find_analyzer(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let candidates = [
        cwd.join("analyzer").join("analyze-demo.js"),
        cwd.join("..").join("analyzer").join("analyze-demo.js"),
        app.path().resource_dir().map_err(|error| error.to_string())?.join("analyzer").join("analyze-demo.js"),
    ];
    candidates.into_iter().find(|path| path.exists()).ok_or("Could not find analyzer/analyze-demo.js".into())
}

fn find_node_runtime(analyzer: &Path) -> PathBuf {
    analyzer
        .parent()
        .map(|parent| parent.join("node.exe"))
        .filter(|path| path.exists())
        .unwrap_or_else(|| PathBuf::from("node"))
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_demos,
            import_demo,
            delete_demo,
            rename_demo,
            open_folder,
            detect_downloads_folder,
            detect_replay_folder,
            copy_to_clipboard,
            run_demo_analyzer,
            export_stats_debug,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
