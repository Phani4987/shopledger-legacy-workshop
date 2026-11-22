'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function makeOrder() {
  var items = [{
    id: 1,
    sku: 'RICE-001',
    name: 'Rice',
    hsn: '1006',
    price: 600,
    qty: 1
  }];
  var totals = pricing.computeTotals(items, 'SAVE10');

  return {
    id: 1001,
    date: '01/01/2026',
    customer: 'In-memory customer',
    status: 'completed',
    items: items,
    coupon: 'SAVE10',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('CURRENT BEHAVIOUR: pricing applies coupon discount before HSN GST', function () {
  var order = makeOrder();
  var totals = pricing.computeTotals(order.items, order.coupon);

  assert.equal(totals.subtotal, 600);
  assert.equal(totals.discount, 60);
  assert.equal(totals.lines[0].gstPercent, 5);
  assert.equal(totals.lines[0].taxable, 540);
  assert.equal(totals.tax, 27);
  assert.equal(totals.cgst, 13.5);
  assert.equal(totals.sgst, 13.5);
  assert.equal(totals.total, 567);
});

test('invoice figures match the billed totals and HSN GST breakdown', function () {
  var order = makeOrder();
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst, 13.5);
  assert.equal(figures.sgst, 13.5);
  assert.equal(figures.total, order.total);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 27);
});

test('GST reconciliation reports the billed order as matched', function () {
  var order = makeOrder();
  var result = reports.getGstReconciliation({
    orders: [order],
    customers: [],
    products: []
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].ledgerTax, 27);
  assert.equal(result.rows[0].invoiceTax, 27);
  assert.equal(result.rows[0].ledgerTotal, 567);
  assert.equal(result.rows[0].invoiceTotal, 567);
  assert.equal(result.rows[0].delta, 0);
});
