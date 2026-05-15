import solc from 'solc';

export interface CompileOutput {
  contractName: string;
  abi: any[];
  bytecode: string;
  warnings: string[];
}

export interface CompileError {
  severity: 'error' | 'warning';
  message: string;
  formatted: string;
}

export class CompileException extends Error {
  constructor(public errors: CompileError[]) {
    super(errors.map((e) => e.message).join('\n'));
  }
}

export function compileSolidity(source: string, filename = 'Contract.sol'): CompileOutput[] {
  const input = {
    language: 'Solidity',
    sources: { [filename]: { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris', // Ganache GUI 2.7.1 不支持 Shanghai PUSH0
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object'] },
      },
    },
  };
  const raw = solc.compile(JSON.stringify(input));
  const output = JSON.parse(raw);
  const allErrors = (output.errors ?? []) as CompileError[];
  const errors = allErrors.filter((e) => e.severity === 'error');
  if (errors.length) throw new CompileException(errors);
  const warnings = allErrors.filter((e) => e.severity === 'warning').map((w) => w.formatted ?? w.message);

  const result: CompileOutput[] = [];
  const fileOut = output.contracts?.[filename] ?? {};
  for (const [name, c] of Object.entries<any>(fileOut)) {
    result.push({
      contractName: name,
      abi: c.abi,
      bytecode: '0x' + (c.evm?.bytecode?.object ?? ''),
      warnings,
    });
  }
  return result;
}
