/** 教师在发布作业时可选用的模板。{caseName} / {courseName} 在选择时被替换 */

export interface AssignmentTemplate {
  id: string;
  name: string;
  desc: string;
  needsCase?: boolean;
  needsCourse?: boolean;
  titleTpl: string;
  contentTpl: string;
}

export const ASSIGNMENT_TEMPLATES: AssignmentTemplate[] = [
  {
    id: 'lab-attack',
    name: '完成漏洞攻击实验',
    desc: '让学生在指定案例上完成攻击合约，提交评测拿到 ≥ 70 分',
    needsCase: true,
    titleTpl: '完成漏洞实验：{caseName}',
    contentTpl:
      '请在截止时间前进入「漏洞实验」→「{caseName}」，编写攻击合约并以 attack 模式提交评测。' +
      '\n\n要求：评测得分 ≥ 70（即必须真正在链上触发漏洞）。' +
      '\n\n参考资料：「五大漏洞深度剖析」对应章节。',
  },
  {
    id: 'lab-fix',
    name: '提交漏洞修复合约',
    desc: '让学生针对指定案例编写修复合约（fix 模式）',
    needsCase: true,
    titleTpl: '提交修复合约：{caseName}',
    contentTpl:
      '请阅读「{caseName}」的漏洞合约，找出问题并编写修复方案。在实验页切换到 fix 模式提交评测。' +
      '\n\n要求：修复合约能阻挡平台的回归攻击，得分 ≥ 70。',
  },
  {
    id: 'study-course',
    name: '学习指定课程',
    desc: '让学生完成某门课程的全部章节',
    needsCourse: true,
    titleTpl: '完成课程学习：{courseName}',
    contentTpl:
      '请在截止时间前完成课程「{courseName}」的全部章节学习，在每节末尾点击「标记完成」。' +
      '\n\n本作业自动结算学习进度，无需手动提交。',
  },
  {
    id: 'lab-attack-fix',
    name: '完成攻击 + 修复全流程',
    desc: '让学生既写攻击合约也写修复合约',
    needsCase: true,
    titleTpl: '完整实验：{caseName} 攻击 + 修复',
    contentTpl:
      '本次实验要求完成两阶段：' +
      '\n\n1️⃣ 在 attack 模式编写攻击合约（≥ 70 分）' +
      '\n\n2️⃣ 在 fix 模式编写修复合约（≥ 70 分）' +
      '\n\n两次提交都通过后视为作业完成。',
  },
  {
    id: 'custom',
    name: '自拟作业内容',
    desc: '完全自定义标题和内容，可选择关联课程或案例',
    titleTpl: '',
    contentTpl: '',
  },
];

export function renderTemplate(
  tpl: AssignmentTemplate,
  ctx: { caseName?: string; courseName?: string },
): { title: string; content: string } {
  const sub = (s: string) => s
    .replaceAll('{caseName}', ctx.caseName ?? '')
    .replaceAll('{courseName}', ctx.courseName ?? '');
  return {
    title: sub(tpl.titleTpl),
    content: sub(tpl.contentTpl),
  };
}
