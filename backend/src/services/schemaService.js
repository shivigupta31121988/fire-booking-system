const schema = require('../schema/form-schema.json');

const allFields = () => schema.pages.flatMap((p) => p.fields.map((f) => ({ ...f, pageId: p.id })));

function matches(cond, answers) {
  if (!cond) return true;
  const v = answers[cond.field];
  if ('equals' in cond) return v === cond.equals;
  if (Array.isArray(cond.in)) return cond.in.includes(v);
  return true;
}

const isVisible = (field, answers) => matches(field.visibleWhen, answers);
const isRequired = (field, answers) =>
  !!field.required || (field.requiredWhen ? matches(field.requiredWhen, answers) : false);

module.exports = { schema, allFields, isVisible, isRequired, matches };
