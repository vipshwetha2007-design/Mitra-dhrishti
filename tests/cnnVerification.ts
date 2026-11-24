import fs from 'fs';
import path from 'path';

interface ModelConfig {
  model_name: string;
  architecture: string;
  input_shape: number[];
  num_classes: number;
  class_mapping: Record<string, string>;
  random_seed: number;
  training_samples: number;
  validation_samples: number;
  batch_size: number;
  initial_lr: number;
  class_weights: Record<string, number>;
  sha256: string;
  saved_at: string;
}

interface TrainingHistory {
  loss: number[];
  accuracy: number[];
  val_loss: number[];
  val_accuracy: number[];
  training_duration_seconds: number;
  epochs_completed: number;
}

interface EvaluationReport {
  test_sample_count: number;
  overall: {
    accuracy: number;
    quadratic_weighted_kappa: number;
    macro_precision: number;
    macro_recall_sensitivity: number;
    macro_f1_score: number;
    weighted_f1_score: number;
    macro_roc_auc_ovr: number;
    referable_dr_sensitivity: number;
    referable_dr_specificity: number;
  };
  per_class: Record<string, {
    name: string;
    support: number;
    precision: number;
    recall_sensitivity: number;
    specificity: number;
    f1_score: number;
  }>;
  confusion_matrix: number[][];
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failed++;
  }
}

console.log('===================================================================');
console.log(' MITRA DRISHTI PHASE 6: CNN MODEL ARTIFACTS & EVALUATION VERIFICATION');
console.log('===================================================================');

const ROOT = process.cwd();
const modelKerasPath = path.join(ROOT, 'models', 'dr_classifier.keras');
const modelConfigPath = path.join(ROOT, 'models', 'model_config.json');
const trainingHistoryPath = path.join(ROOT, 'models', 'training_history.json');
const evalReportJsonPath = path.join(ROOT, 'reports', 'model_evaluation_report.json');
const evalReportMdPath = path.join(ROOT, 'reports', 'model_evaluation_report.md');

// 1. Keras model file checks
assert(fs.existsSync(modelKerasPath), 'Trained model file exists (models/dr_classifier.keras)');
const modelStat = fs.statSync(modelKerasPath);
assert(modelStat.size > 8 * 1024 * 1024, `Trained model file size is valid (${(modelStat.size / (1024 * 1024)).toFixed(2)} MB > 8 MB)`);

// 2. Model configuration checks
assert(fs.existsSync(modelConfigPath), 'Model configuration JSON exists (models/model_config.json)');
const config: ModelConfig = JSON.parse(fs.readFileSync(modelConfigPath, 'utf-8'));
assert(config.architecture.includes('MobileNetV2'), `Architecture specifies MobileNetV2 (${config.architecture})`);
assert(config.num_classes === 5, `Configured for 5 ICDR classes (${config.num_classes})`);
assert(config.input_shape[0] === 224 && config.input_shape[1] === 224 && config.input_shape[2] === 3, 'Input shape is [224, 224, 3]');
assert(config.training_samples === 2629, `Training samples verified: ${config.training_samples}`);
assert(config.validation_samples === 373, `Validation samples verified: ${config.validation_samples}`);
assert(typeof config.sha256 === 'string' && config.sha256.length === 64, `Model SHA-256 digest recorded: ${config.sha256.slice(0, 16)}...`);

// 3. Training history checks
assert(fs.existsSync(trainingHistoryPath), 'Training history JSON exists (models/training_history.json)');
const history: TrainingHistory = JSON.parse(fs.readFileSync(trainingHistoryPath, 'utf-8'));
assert(history.epochs_completed >= 3, `Epochs completed verified: ${history.epochs_completed}`);
assert(history.accuracy[history.accuracy.length - 1] > 0.65, `Final training accuracy is genuine (> 65%): ${(history.accuracy[history.accuracy.length - 1] * 100).toFixed(2)}%`);
assert(history.val_accuracy[history.val_accuracy.length - 1] > 0.60, `Final validation accuracy is genuine (> 60%): ${(history.val_accuracy[history.val_accuracy.length - 1] * 100).toFixed(2)}%`);
assert(history.training_duration_seconds > 0, `Training duration recorded: ${history.training_duration_seconds}s`);

// 4. Held-out test evaluation report checks
assert(fs.existsSync(evalReportJsonPath), 'Evaluation JSON report exists (reports/model_evaluation_report.json)');
assert(fs.existsSync(evalReportMdPath), 'Evaluation Markdown report exists (reports/model_evaluation_report.md)');

const evalData: EvaluationReport = JSON.parse(fs.readFileSync(evalReportJsonPath, 'utf-8'));
assert(evalData.test_sample_count === 660, `Evaluated on full held-out test split (660 samples): ${evalData.test_sample_count}`);
assert(evalData.overall.accuracy >= 0.70, `Held-out test accuracy meets threshold (> 70%): ${(evalData.overall.accuracy * 100).toFixed(2)}%`);
assert(evalData.overall.quadratic_weighted_kappa >= 0.75, `Quadratic Weighted Kappa meets clinical threshold (>= 0.75): ${evalData.overall.quadratic_weighted_kappa.toFixed(4)}`);
assert(evalData.overall.referable_dr_sensitivity >= 0.80, `Referable DR sensitivity meets clinical screening standard (>= 80%): ${(evalData.overall.referable_dr_sensitivity * 100).toFixed(2)}%`);
assert(evalData.overall.referable_dr_specificity >= 0.90, `Referable DR specificity minimizes false positive referrals (>= 90%): ${(evalData.overall.referable_dr_specificity * 100).toFixed(2)}%`);
assert(evalData.overall.macro_roc_auc_ovr >= 0.85, `Macro ROC-AUC discriminability meets high standard (>= 0.85): ${evalData.overall.macro_roc_auc_ovr.toFixed(4)}`);

// 5. Confusion matrix structure checks
assert(evalData.confusion_matrix.length === 5 && evalData.confusion_matrix[0].length === 5, 'Confusion matrix is a 5x5 matrix');
const totalCm = evalData.confusion_matrix.flat().reduce((a, b) => a + b, 0);
assert(totalCm === 660, `Confusion matrix sums to exactly 660 test samples (${totalCm})`);

console.log('-------------------------------------------------------------------');
console.log(`Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
