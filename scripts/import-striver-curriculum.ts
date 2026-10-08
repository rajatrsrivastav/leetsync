import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { assertStableProblemIds, curriculumFromCsv } from '../src/domain/curriculum/import';
import { validateCurriculum } from '../src/domain/curriculum/validation';

const help = `Import verified Striver curriculum navigation metadata.

  pnpm import:curriculum curriculum.json [--output path] [--check]
  pnpm import:curriculum curriculum.csv --metadata metadata.json [--output path] [--check]

Default output: src/data/curricula/striver180.json
--check validates without writing. The importer never fetches or guesses metadata.
See docs/CURRICULUM.md for schema, provenance and stable-ID requirements.`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(help);
    return;
  }
  let input: string | undefined;
  let metadataPath: string | undefined;
  let output = resolve('src/data/curricula/striver180.json');
  let check = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '--check') check = true;
    else if (arg === '--output' || arg === '--metadata') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a path.`);
      if (arg === '--output') output = resolve(value);
      else metadataPath = resolve(value);
    } else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else if (input) throw new Error('Specify exactly one input file.');
    else input = resolve(arg);
  }
  if (!input) throw new Error(help);
  const raw = await readFile(input, 'utf8');
  let data;
  if (extname(input).toLowerCase() === '.csv') {
    if (!metadataPath)
      throw new Error('CSV imports require --metadata with a verified JSON metadata file.');
    data = curriculumFromCsv(raw, JSON.parse(await readFile(metadataPath, 'utf8')));
  } else if (extname(input).toLowerCase() === '.json') data = validateCurriculum(JSON.parse(raw));
  else throw new Error('Input must have a .json or .csv extension.');
  if (data.id !== 'striver180')
    throw new Error('This importer requires curriculum id "striver180".');
  let previous;
  try {
    previous = validateCurriculum(JSON.parse(await readFile(output, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (previous) {
    assertStableProblemIds(previous, data);
    if (previous.complete && (!data.complete || data.problems.length < previous.problems.length)) {
      throw new Error(
        'Refusing to replace a complete dataset with a partial/smaller one. Use --output to review it separately.',
      );
    }
    const missing = previous.problems.filter(
      (problem) => !data.problems.some((next) => next.id === problem.id),
    );
    if (missing.length)
      throw new Error(
        `Refusing to remove ${missing.length} existing problem IDs. Use --output to review a curriculum change separately.`,
      );
  }
  if (check) {
    console.log(
      `Valid: ${data.problems.length}/${data.expectedCount} problems; version ${data.version}; no files written.`,
    );
    return;
  }
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  await rename(temporary, output);
  console.log(
    `Imported ${data.problems.length}/${data.expectedCount} problems to ${output}. Verify the diff, run tests/typecheck, then rebuild the extension.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Curriculum import failed.');
  process.exitCode = 1;
});
