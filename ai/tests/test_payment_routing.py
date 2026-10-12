"""
Tests for PaymentRoutingService.

Covers the destructive-consumption bug in find_best_routes (#16): the fallback
branch used to alias `self.available_chains` and then `heapq.heappop` entries out
of it, so the routing table shrank with every request that fell back.

Run with:  python -m pytest ai/tests/test_payment_routing.py
      or:  python -m unittest discover -s ai/tests
"""
import unittest

from services.payment_routing import PaymentRoutingService


class FindBestRoutesDoesNotMutateStateTest(unittest.TestCase):
    """The routing table is long-lived instance state and must not be drained."""

    def setUp(self):
        self.service = PaymentRoutingService()
        self.initial_count = len(self.service.available_chains)
        self.initial_names = [c.chain for c in self.service.available_chains]
        # Amount above every chain's liquidity forces the fallback branch.
        self.fallback_tx = {'amount': 99_999_999, 'currency': 'XLM'}

    def test_starting_table_is_populated(self):
        self.assertGreater(self.initial_count, 0)
        self.assertEqual(len(self.initial_names), self.initial_count)

    def test_fallback_branch_does_not_shrink_the_table(self):
        self.service.find_best_routes(self.fallback_tx)
        self.assertEqual(len(self.service.available_chains), self.initial_count)

    def test_table_survives_100_consecutive_fallback_calls(self):
        # The reported failure drained 8 -> 5 -> 2 -> 0 across a handful of calls.
        for _ in range(100):
            self.service.find_best_routes(self.fallback_tx)

        self.assertEqual(len(self.service.available_chains), self.initial_count)
        self.assertEqual(
            [c.chain for c in self.service.available_chains], self.initial_names
        )

    def test_repeated_calls_return_identical_results(self):
        first = self.service.find_best_routes(self.fallback_tx)
        for _ in range(20):
            self.assertEqual(self.service.find_best_routes(self.fallback_tx), first)

    def test_results_do_not_depend_on_call_history(self):
        """A fresh service and a heavily-used one must agree."""
        fresh = PaymentRoutingService()

        warm = PaymentRoutingService()
        for _ in range(50):
            warm.find_best_routes(self.fallback_tx)

        self.assertEqual(
            fresh.find_best_routes(self.fallback_tx),
            warm.find_best_routes(self.fallback_tx),
        )

    def test_non_fallback_branch_does_not_mutate_either(self):
        # Small amount: the list-comprehension branch, which already copied.
        small = {'amount': 1, 'currency': 'XLM'}
        for _ in range(50):
            self.service.find_best_routes(small)
        self.assertEqual(len(self.service.available_chains), self.initial_count)


class FindBestRoutesResultsTest(unittest.TestCase):
    """The returned routes must be correct, sorted, and bounded by `limit`."""

    def setUp(self):
        self.service = PaymentRoutingService()

    def test_returns_at_most_limit_routes(self):
        routes = self.service.find_best_routes({'amount': 100, 'currency': 'USD'})
        self.assertLessEqual(len(routes), 3)

    def test_respects_an_explicit_limit(self):
        routes = self.service.find_best_routes(
            {'amount': 100, 'currency': 'USD'}, limit=2
        )
        self.assertEqual(len(routes), 2)

    def test_limit_zero_returns_nothing(self):
        self.assertEqual(
            self.service.find_best_routes({'amount': 100, 'currency': 'USD'}, limit=0),
            [],
        )

    def test_limit_larger_than_table_returns_everything(self):
        routes = self.service.find_best_routes(
            {'amount': 99_999_999, 'currency': 'XLM'}, limit=1000
        )
        self.assertEqual(len(routes), len(self.service.available_chains))

    def test_routes_are_sorted_by_ascending_score(self):
        routes = self.service.find_best_routes(
            {'amount': 99_999_999, 'currency': 'XLM'}, limit=8
        )
        scores = [r['score'] for r in routes]
        self.assertEqual(scores, sorted(scores))

    def test_route_payload_has_expected_shape(self):
        route = self.service.find_best_routes({'amount': 100, 'currency': 'USD'})[0]
        for key in ('chain', 'fee', 'time', 'liquidity', 'score'):
            self.assertIn(key, route)

    def test_fallback_returns_routes_rather_than_empty(self):
        """The endpoint depends on a non-empty list; see ai/main.py."""
        routes = self.service.find_best_routes({'amount': 99_999_999, 'currency': 'XLM'})
        self.assertTrue(routes)
        self.assertIsNotNone(routes[0])

    def test_liquidity_filter_is_unit_documented(self):
        """Filtering compares against USD liquidity via _to_usd."""
        # Every seeded chain has liquidity >= 100000, so a 100 USD amount keeps
        # the chains that clear it.
        routes = self.service.find_best_routes({'amount': 100, 'currency': 'USD'}, limit=8)
        self.assertGreater(len(routes), 0)

        # An amount above all liquidity falls back rather than returning nothing.
        fallback_routes = self.service.find_best_routes(
            {'amount': 99_999_999, 'currency': 'XLM'}, limit=8
        )
        self.assertEqual(len(fallback_routes), len(self.service.available_chains))


class ToUsdTest(unittest.TestCase):
    """Unit handling for the liquidity comparison (#16)."""

    def setUp(self):
        self.service = PaymentRoutingService()

    def test_usd_passes_through(self):
        self.assertEqual(self.service._to_usd(250, 'USD'), 250)

    def test_stablecoins_pass_through(self):
        for code in ('USDC', 'usdt', 'USDT'):
            self.assertEqual(self.service._to_usd(100, code), 100)

    def test_xlm_passes_through(self):
        self.assertEqual(self.service._to_usd(100, 'XLM'), 100)

    def test_missing_currency_passes_through(self):
        self.assertEqual(self.service._to_usd(100, ''), 100)

    def test_unknown_currency_is_a_documented_passthrough(self):
        # No price feed is wired in, so the amount is returned unchanged.
        self.assertEqual(self.service._to_usd(100, 'JPY'), 100)


if __name__ == '__main__':
    unittest.main()
