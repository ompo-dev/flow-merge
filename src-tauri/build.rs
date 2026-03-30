fn main() {
  println!("cargo:rerun-if-env-changed=FLOW_MERGE_UPDATE_REPOSITORY");
  println!("cargo:rerun-if-env-changed=FLOW_MERGE_UPDATE_PUBLIC_KEY");
  tauri_build::build()
}
