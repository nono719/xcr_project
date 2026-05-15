import Editor, { type OnMount } from '@monaco-editor/react';

interface Props {
  value: string;
  onChange?: (v: string) => void;
  language?: string;
  height?: number | string;
  readOnly?: boolean;
}

export default function MonacoIDE({ value, onChange, language = 'sol', height = 400, readOnly = false }: Props) {
  const onMount: OnMount = (editor, monaco) => {
    if (!monaco.languages.getLanguages().some((l) => l.id === 'sol')) {
      monaco.languages.register({ id: 'sol' });
      monaco.languages.setMonarchTokensProvider('sol', {
        defaultToken: '',
        tokenPostfix: '.sol',
        keywords: [
          'pragma','solidity','contract','interface','library','function','modifier','event','struct','enum',
          'mapping','address','uint','uint8','uint16','uint32','uint64','uint128','uint256','int','int256',
          'bool','string','bytes','bytes32','public','private','internal','external','view','pure','payable',
          'returns','return','memory','storage','calldata','if','else','for','while','do','break','continue',
          'require','revert','assert','emit','new','this','super','using','virtual','override','abstract',
          'constructor','receive','fallback','immutable','constant','unchecked','try','catch','import','as','is',
          'true','false','msg','tx','block','now','wei','gwei','ether','seconds','minutes','hours','days',
        ],
        operators: ['=','==','!=','<','>','<=','>=','+','-','*','/','%','&&','||','!','&','|','^','~','<<','>>'],
        symbols: /[=><!~?:&|+\-*\/\^%]+/,
        tokenizer: {
          root: [
            [/\/\/.*$/, 'comment'],
            [/\/\*/, 'comment', '@comment'],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
            [/0[xX][0-9a-fA-F]+/, 'number.hex'],
            [/\d+/, 'number'],
            [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
            [/[{}()\[\]]/, '@brackets'],
            [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
            [/[;,.]/, 'delimiter'],
          ],
          string: [
            [/[^\\"]+/, 'string'],
            [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
          ],
          comment: [
            [/[^\/*]+/, 'comment'],
            [/\*\//, 'comment', '@pop'],
            [/./, 'comment'],
          ],
        },
      });
    }
    editor.updateOptions({ tabSize: 4, minimap: { enabled: false } });
  };

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      onChange={(v) => onChange?.(v ?? '')}
      onMount={onMount}
      options={{ readOnly, fontSize: 13, automaticLayout: true, scrollBeyondLastLine: false }}
      theme="vs-dark"
    />
  );
}
