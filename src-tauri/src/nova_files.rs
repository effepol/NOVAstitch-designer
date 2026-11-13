//! NOVAstitch (module 0, for module a): the file operations of a project save
//! in two steps, limited to the folder the user chose. Module a writes a
//! temporary file next to the `.nsd`, reads it back, renames it over the
//! `.nsd`, and removes it on failure. These commands accept only:
//!
//! - a `.nsd` the user chose (in the file system scope: picked in an Open or
//!   Save dialog, or opened with the app), as the target of a rename;
//! - its temporary files, `.<name>.<random>.nsd-tmp` in the same folder.
//!
//! No other path can be written, renamed, removed or listed: the web view gets
//! no general rename or remove permission.

use std::io::Write;
use std::path::{Path, PathBuf};

use tauri::Runtime;
use tauri_plugin_fs::FsExt;

const TMP_SUFFIX: &str = ".nsd-tmp";

fn is_nsd(p: &Path) -> bool {
    p.extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case("nsd"))
}

/// The `.nsd` a temporary file belongs to: `<dir>/.<name>.<random>.nsd-tmp` → `<dir>/<name>`.
pub fn tmp_target(tmp: &Path) -> Option<PathBuf> {
    let file = tmp.file_name()?.to_str()?;
    let inner = file.strip_prefix('.')?.strip_suffix(TMP_SUFFIX)?;
    let (name, random) = inner.rsplit_once('.')?;
    if random.is_empty() || !random.chars().all(|c| c.is_ascii_alphanumeric()) || name.is_empty() {
        return None;
    }
    let target = tmp.with_file_name(name);
    is_nsd(&target).then_some(target)
}

fn chosen<R: Runtime>(app: &tauri::AppHandle<R>, nsd: &Path) -> bool {
    is_nsd(nsd) && app.fs_scope().is_allowed(nsd)
}

/// A temporary file of a `.nsd` the user chose; else an error naming the path.
fn tmp_of_chosen<R: Runtime>(app: &tauri::AppHandle<R>, tmp: &str) -> Result<(PathBuf, PathBuf), String> {
    let tmp = PathBuf::from(tmp);
    match tmp_target(&tmp) {
        Some(target) if chosen(app, &target) => Ok((tmp, target)),
        _ => Err(format!("{}: not a temporary file of a project chosen by the user", tmp.display())),
    }
}

/// Writes the temporary file and flushes it to the disk.
#[tauri::command]
pub fn nova_project_write<R: Runtime>(app: tauri::AppHandle<R>, path: String, bytes: Vec<u8>) -> Result<(), String> {
    let (tmp, _) = tmp_of_chosen(&app, &path)?;
    let mut f = std::fs::File::create(&tmp).map_err(|e| format!("{}: {e}", tmp.display()))?;
    f.write_all(&bytes).and_then(|_| f.sync_all()).map_err(|e| format!("{}: {e}", tmp.display()))
}

/// Reads the temporary file back (module a compares it with what it sent).
#[tauri::command]
pub fn nova_project_read<R: Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<Vec<u8>, String> {
    let (tmp, _) = tmp_of_chosen(&app, &path)?;
    std::fs::read(&tmp).map_err(|e| format!("{}: {e}", tmp.display()))
}

/// Renames the temporary file over its `.nsd` (replacing it on every system).
#[tauri::command]
pub fn nova_project_rename<R: Runtime>(app: tauri::AppHandle<R>, from: String, to: String) -> Result<(), String> {
    let (tmp, target) = tmp_of_chosen(&app, &from)?;
    if Path::new(&to) != target {
        return Err(format!("{to}: a temporary file is renamed only over its own project"));
    }
    std::fs::rename(&tmp, &target).map_err(|e| format!("{}: {e}", target.display()))
}

/// Removes a temporary file (after a failure, or the leftover of a crash).
#[tauri::command]
pub fn nova_project_remove<R: Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<(), String> {
    let (tmp, _) = tmp_of_chosen(&app, &path)?;
    match std::fs::remove_file(&tmp) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(format!("{}: {e}", tmp.display())),
        _ => Ok(()),
    }
}

/// The temporary files in a folder that belong to a `.nsd` the user chose (nothing else is listed).
#[tauri::command]
pub fn nova_project_list<R: Runtime>(app: tauri::AppHandle<R>, dir: String) -> Result<Vec<String>, String> {
    let dir = PathBuf::from(dir);
    let entries = std::fs::read_dir(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    Ok(entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| tmp_target(p).is_some_and(|t| chosen(&app, &t)))
        .filter_map(|p| p.file_name().and_then(|n| n.to_str()).map(String::from))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_temporary_file_names_its_project() {
        let t = |s: &str| tmp_target(Path::new(s)).map(|p| p.to_string_lossy().into_owned());
        assert_eq!(t("/d/.Stemma.nsd.ab12cd34.nsd-tmp").as_deref(), Some("/d/Stemma.nsd"));
        assert_eq!(t("/d/.Mio disegno.NSD.x9.nsd-tmp").as_deref(), Some("/d/Mio disegno.NSD"));
        assert_eq!(t("/d/.a.b.nsd.r.nsd-tmp").as_deref(), Some("/d/a.b.nsd"));
    }

    #[test]
    fn nothing_else_is_a_temporary_file() {
        for s in [
            "/d/Stemma.nsd",                    // the project itself
            "/d/.Stemma.filum.ab12.nsd-tmp",    // a .filum is never a target
            "/d/.Stemma.nsd.nsd-tmp",           // no random part
            "/d/.Stemma.nsd.a/b.nsd-tmp",       // not a plain name
            "/d/.Stemma.nsd.ab-12.nsd-tmp",     // the random part is letters and digits only
            "/d/Stemma.nsd.ab12.nsd-tmp",       // no leading dot
            "/d/..ab12.nsd-tmp",                // no name
            "/d/.Stemma.nsd.ab12.tmp",          // another suffix
            "/etc/passwd",
        ] {
            assert_eq!(tmp_target(Path::new(s)), None, "{s}");
        }
    }
}
