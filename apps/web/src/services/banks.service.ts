import directory from "@/constants/nigerian-banks.json";
const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const preferred = [
  "000014",
  "000004",
  "000015",
  "000016",
  "000013",
  "000017",
  "100004",
  "090267",
  "100033",
  "090405",
];
const banks = [...directory].sort((a, b) => {
  const ai = preferred.indexOf(a.code),
    bi = preferred.indexOf(b.code);
  return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.name.localeCompare(b.name);
});
export const banksService = {
  options: (search: string) => {
    const query = normalize(search);
    return banks.filter(
      (bank) =>
        !query ||
        [bank.name, ...bank.aliases, bank.code].some((value) => normalize(value).includes(query)),
    );
  },
  find: (name: string) => {
    const query = normalize(name);
    return (
      banks.find((bank) =>
        [bank.name, ...bank.aliases].some((value) => normalize(value) === query),
      ) ?? null
    );
  },
  count: banks.length,
};
