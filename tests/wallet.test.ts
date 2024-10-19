import test from 'node:test';
import assert from 'node:assert/strict';

// https://betterstack.com/community/guides/testing/best-node-testing-libraries/
test('calculateTotal', () => {
  const cartItems = [{ price: 20 }, { price: 30 }];

  let totalPrice = 0;

  cartItems.forEach((item) => {
    totalPrice += item.price;
  });

  assert.equal(totalPrice, 50);
});
