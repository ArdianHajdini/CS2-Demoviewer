use std::{env, fs::File, io, path::PathBuf};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let source = PathBuf::from(env::args().nth(1).ok_or("missing source path")?);
    let destination = PathBuf::from(env::args().nth(2).ok_or("missing destination path")?);
    let input = File::open(source)?;
    let mut decoder = zstd::stream::read::Decoder::new(input)?;
    let mut output = File::create(destination)?;
    io::copy(&mut decoder, &mut output)?;
    Ok(())
}
