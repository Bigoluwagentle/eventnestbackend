// Checks that every index the models declare really exists in the live database (and builds any that are
// missing). It exists because a unique or partial index that fails to build does so SILENTLY: the app
// keeps running, but the rule it was meant to enforce is gone.
//
// Usage, from the project root:   node scripts/verify-indexes.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// JSON with sorted keys, so two objects with the same content compare equal
const stable = (value) => JSON.stringify(value, (key, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));

// An index key's field ORDER (and direction) is part of what the index is: event+user is not user+event.
const orderedKey = (key) => JSON.stringify(Object.entries(key));

// What is wrong, if anything, between the indexes a model declares and the ones the database has?
function compareIndexes(declared, existing) {
  const problems = [];
  declared.forEach(([fields, options = {}]) => {
    const label = Object.keys(fields).join('+');
    const found = existing.find((index) => orderedKey(index.key) === orderedKey(fields));
    if (!found) return problems.push(`missing index on ${label}`);
    if (options.unique && !found.unique) problems.push(`index on ${label} should be unique but is not`);
    if (options.partialFilterExpression && stable(found.partialFilterExpression) !== stable(options.partialFilterExpression)) {
      problems.push(`index on ${label} has a different partial filter than the model declares`);
    }
    return undefined;
  });
  return problems;
}

async function main() {
  const env = require('../src/config/env');
  const modelsDirectory = path.join(__dirname, '..', 'src', 'models');
  fs.readdirSync(modelsDirectory).filter((file) => file.endsWith('.js')).forEach((file) => require(path.join(modelsDirectory, file)));

  await mongoose.connect(env.MONGO_URI);
  let broken = 0;

  for (const name of Object.keys(mongoose.models).sort()) {
    const model = mongoose.models[name];
    try {
      await model.createIndexes(); // builds whatever is missing; throws when an index cannot be built
      const problems = compareIndexes(model.schema.indexes(), await model.collection.indexes());
      if (problems.length) {
        broken += 1;
        console.log(`PROBLEM ${name}:`);
        problems.forEach((problem) => console.log(`          - ${problem}`));
      } else {
        console.log(`ok      ${name}`);
      }
    } catch (err) {
      broken += 1;
      console.log(`FAILED  ${name}: ${err.message}`);
    }
  }

  await mongoose.disconnect();
  console.log(broken ? `\n${broken} model(s) need attention. Paste this output to get a fix.` : '\nAll declared indexes exist.');
  process.exitCode = broken ? 1 : 0;
}

module.exports = { compareIndexes };

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}