
import { MOTStage, PlaybookEntry } from './types';

export const MOT_PLAYBOOK: Record<MOTStage, PlaybookEntry> = {
  [MOTStage.EXPLORE]: {
    definition: "表达兴趣、表现关注、开放式提问、复述澄清、理解需求。",
    recommendations: [
      "“为了能更好地帮到您，我能先请教几个细节吗？”",
      "“您提到的这一点非常关键，我的理解是...对吗？”",
      "“除了您刚才说的，还有什么是您比较在意的吗？”",
      "“听起来您现在最困扰的是...我没理解错吧？”",
      "“能具体跟我说说当时的情况吗？”"
    ],
    pitfalls: ["急于给方案", "打断客户陈述", "封闭式提问过多"]
  },
  [MOTStage.PROPOSE]: {
    definition: "互惠、完整、确认利益所在、正向替代方案。",
    recommendations: [
      "“基于您的需求，我为您定制了这样一个方案...”",
      "“如果您选择这个，不仅能解决...还能额外获得...”",
      "“虽然目前A方案无法实现，但我可以为您申请B方案作为替代。”",
      "“这个方案对您来说最大的好处是...”",
      "“您看这个提议能满足您的预期吗？”"
    ],
    pitfalls: ["专业术语过多", "只说功能不说益处", "强行推销"]
  },
  [MOTStage.ACT]: {
    definition: "5C原则：澄清记录、确认、协调、控制、确认。",
    recommendations: [
      "“我现在立刻为您去后台核实，请稍等我1分钟。”",
      "“我已经为您备注好了特殊需求，接下来的流程是...”",
      "“为了确保万无一失，我再次核对一下核心条款。”",
      "“这个环节由我来全程跟进，有进度我会第一时间通知您。”",
      "“好的，手续已经办妥了，这是您的凭证。”"
    ],
    pitfalls: ["承诺含糊不清", "缺乏进度反馈", "流程断档"]
  },
  [MOTStage.CONFIRM]: {
    definition: "确认达到/超过客户期望，确认结果与下一步。",
    recommendations: [
      "“刚才的处理结果，您还满意吗？”",
      "“除此之外，还有什么是我今天能为您做的吗？”",
      "“后续如果您有任何问题，随时可以联系我。”",
      "“很高兴能帮您解决问题，祝您今天心情愉快。”",
      "“确认一下，我们刚才约定的下一步动作是...”"
    ],
    pitfalls: ["草率结尾", "忽略情感连接", "未交待下一步"]
  },
  [MOTStage.FULL]: {
    definition: "完整覆盖从探索到确认的全流程服务环节。",
    recommendations: ["（综合以上各阶段句式）"],
    pitfalls: ["（综合以上各阶段坑点）"]
  }
};

export const INDUSTRIES = ['餐饮', '零售', '酒店', '客服', '售后'] as const;
export const PERSONAS = ['温和', '挑剔', '愤怒', '犹豫', '理性'] as const;
export const VOICE_NAMES = ['Kore', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'] as const;
