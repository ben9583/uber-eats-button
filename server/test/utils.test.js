const { risk_distribution } = require('../src/utils');

const epsilon = 0.0000001;

test('risk distribution returns numbers between 0 and 1', () => {
  const distribution1 = risk_distribution(10, 5);
  expect(distribution1.every(x => x >= 0 && x <= 1)).toBe(true);
  const distribution2 = risk_distribution(10, 0);
  expect(distribution2.every(x => x >= 0 && x <= 1)).toBe(true);
  const distribution3 = risk_distribution(2, 100);
  expect(distribution3.every(x => x >= 0 && x <= 1)).toBe(true);
  const distribution4 = risk_distribution(200, 0);
  expect(distribution4.every(x => x >= 0 && x <= 1)).toBe(true);
  const distribution5 = risk_distribution(200, 100);
  expect(distribution5.every(x => x >= 0 && x <= 1)).toBe(true);
});

test('risk distribution with safety zero is uniform', () => {
  const distribution1 = risk_distribution(2, 0);
  expect(distribution1.every(x => Math.abs(x - 0.5) < epsilon)).toBe(true);
  const distribution2 = risk_distribution(10, 0);
  expect(distribution2.every(x => Math.abs(x - 0.1) < epsilon)).toBe(true);
  const distribution3 = risk_distribution(100, 0);
  expect(distribution3.every(x => Math.abs(x - 0.01) < epsilon)).toBe(true);
  const distribution4 = risk_distribution(1000, 0);
  expect(distribution4.every(x => Math.abs(x - 0.001) < epsilon)).toBe(true);
});

test('risk distribution with safety > 0 is monotonically decreasing', () => {
  const distribution1 = risk_distribution(2, 5);
  expect(distribution1[0] > distribution1[1]).toBe(true);
  const distribution2 = risk_distribution(5, 5);
  expect(distribution2[0] > distribution2[1]).toBe(true);
  expect(distribution2[1] > distribution2[2]).toBe(true);
  expect(distribution2[2] > distribution2[3]).toBe(true);
  expect(distribution2[3] > distribution2[4]).toBe(true);
  const distribution3 = risk_distribution(5, 1);
  expect(distribution3[0] > distribution3[1]).toBe(true);
  expect(distribution3[1] > distribution3[2]).toBe(true);
  expect(distribution3[2] > distribution3[3]).toBe(true);
  expect(distribution3[3] > distribution3[4]).toBe(true);
  const distribution4 = risk_distribution(5, 10);
  expect(distribution4[0] > distribution4[1]).toBe(true);
  expect(distribution4[1] > distribution4[2]).toBe(true);
  expect(distribution4[2] > distribution4[3]).toBe(true);
  expect(distribution4[3] > distribution4[4]).toBe(true);
})

test('risk distribution array sums to 1', () => {
  const distribution1 = risk_distribution(10, 5);
  expect(Math.abs(distribution1.reduce((a, b) => a + b, 0) - 1) < epsilon).toBe(true);
  const distribution2 = risk_distribution(10, 0);
  expect(Math.abs(distribution2.reduce((a, b) => a + b, 0) - 1) < epsilon).toBe(true);
  const distribution3 = risk_distribution(2, 10);
  expect(Math.abs(distribution3.reduce((a, b) => a + b, 0) - 1) < epsilon).toBe(true);
  const distribution4 = risk_distribution(200, 0);
  expect(Math.abs(distribution4.reduce((a, b) => a + b, 0) - 1) < epsilon).toBe(true);
  const distribution5 = risk_distribution(200, 10);
  expect(Math.abs(distribution5.reduce((a, b) => a + b, 0) - 1) < epsilon).toBe(true);
});

test('risk distribution follows known examples', () => {
  const actual1 = risk_distribution(2, 5);
  const expected1 = [0.924141819979, 0.075858180021];
  for(let i = 0; i < 2; i++) {
    expect(Math.abs(actual1[i] - expected1[i]) < epsilon).toBe(true);
  }
  const actual2 = risk_distribution(10, 5);
  const expected2 = [0.396138500508, 0.240270146051, 0.145731210193, 0.088390447059, 0.053611516167, 0.032517028269, 0.019722574608, 0.011962346188, 0.007255529725, 0.0044007012];
  for(let i = 0; i < 10; i++) {
    expect(Math.abs(actual2[i] - expected2[i]) < epsilon).toBe(true);
  }
  const actual3 = risk_distribution(5, 1);
  const expected3 = [0.286763726302, 0.234782281591, 0.192223474216, 0.157379269804, 0.128851248086];
  for(let i = 0; i < 5; i++) {
    expect(Math.abs(actual3[i] - expected3[i]) < epsilon).toBe(true);
  }
  const actual4 = risk_distribution(5, 5);
  const expected4 = [0.636408646559, 0.234121657253, 0.086128544436, 0.031684920796, 0.011656230956]
  for(let i = 0; i < 5; i++) {
    expect(Math.abs(actual4[i] - expected4[i]) < epsilon).toBe(true);
  }
  const actual5 = risk_distribution(5, 10);
  const expected5 = [0.864703974263, 0.117024957273, 0.015837605738, 0.002143386858, 0.00029007586756];
  for(let i = 0; i < 5; i++) {
    expect(Math.abs(actual5[i] - expected5[i]) < epsilon).toBe(true);
  }
});
