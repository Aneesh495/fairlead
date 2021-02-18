# Almgren-Chriss Optimal Execution: Mathematical Derivation & Implementation

## Theoretical Framework

The Almgren-Chriss (2000) optimal execution framework addresses the institutional problem of liquidating a large block of shares $X$ over a finite trading horizon $T$ while minimizing the combined penalty of market impact and timing risk.

A trader liquidating shares faces a fundamental trade-off:
- **Fast Execution**: Minimizes exposure to market volatility (timing risk), but incurs severe market impact costs due to taking liquidity aggressively across the order book.
- **Slow Execution**: Minimizes market impact costs by allowing liquidity to replenish, but leaves the portfolio exposed to adverse price drift driven by exogenous market volatility.

Fairlead implements the exact discrete and continuous Almgren-Chriss closed-form trajectories in `AlmgrenChrissExecutionEngine.gs`.

---

## Market Dynamics & Price Impact

Let the trading horizon $[0, T]$ be partitioned into $N$ discrete intervals of uniform duration $\tau = T / N$ at time coordinates $t_k = k \tau$ for $k = 0, \dots, N$.

Let $x_k$ denote the number of shares remaining to be liquidated at time $t_k$, with boundary conditions:
$$x_0 = X, \quad x_N = 0$$

The number of shares traded in interval $k$ is:
$$n_k = x_{k-1} - x_k, \quad \sum_{k=1}^N n_k = X$$

The instantaneous trading rate is $v_k = n_k / \tau$.

### 1. Midpoint Price Dynamics (Permanent Impact)

The underlying asset price $S_k$ evolves according to an arithmetic random walk subject to permanent price impact:

$$S_k = S_{k-1} + \sigma \tau^{1/2} \xi_k - \tau g(v_k)$$

where:
- $\sigma$ is the daily asset volatility.
- $\xi_k \sim \mathcal{N}(0, 1)$ are independent and identically distributed standard Gaussian shocks.
- $g(v) = \gamma v$ is the linear permanent price impact function with parameter $\gamma > 0$.

### 2. Realized Execution Price (Temporary Impact)

The actual transaction price $\tilde{S}_k$ obtained in interval $k$ differs from the midpoint $S_k$ due to temporary liquidity concession:

$$\tilde{S}_k = S_{k-1} - h(v_k)$$

where $h(v) = \eta v$ represents the linear temporary price impact function with parameter $\eta > 0$.

---

## The Optimization Problem

The total capture from liquidation is:

$$\mathcal{C} = \sum_{k=1}^N n_k \tilde{S}_k$$

The implementation shortfall (cost of liquidation relative to initial value $X S_0$) is:

$$x_{\text{IS}} = X S_0 - \mathcal{C}$$

### Expected Shortfall $E[x_{\text{IS}}]$

Taking expectations yields the deterministic cost of execution:

$$E[x_{\text{IS}}] = \frac{1}{2} \gamma X^2 + \eta \sum_{k=1}^N \frac{n_k^2}{\tau}$$

The first term $\frac{1}{2} \gamma X^2$ is the path-independent permanent impact cost. The second term $\eta \sum_{k=1}^N \frac{n_k^2}{\tau}$ is the path-dependent temporary impact cost.

### Variance of Shortfall $V[x_{\text{IS}}]$

The timing risk associated with holding unhedged inventory is:

$$V[x_{\text{IS}}] = \sigma^2 \sum_{k=1}^N \tau x_k^2$$

### Utility Optimization

Under mean-variance utility with risk aversion parameter $\lambda > 0$, the objective is to minimize:

$$U(x) = E[x_{\text{IS}}] + \lambda V[x_{\text{IS}}] = \frac{1}{2} \gamma X^2 + \sum_{k=1}^N \left[ \frac{\eta}{\tau} (x_{k-1} - x_k)^2 + \lambda \sigma^2 \tau x_k^2 \right]$$

---

## Continuous Formulation & Euler-Lagrange Solution

In the continuous limit as $\tau \to 0$, the objective functional becomes:

$$\min_{x(t)} \int_0^T \left[ \eta \dot{x}(t)^2 + \lambda \sigma^2 x(t)^2 \right] dt$$

subject to $x(0) = X$ and $x(T) = 0$.

Applying the Euler-Lagrange equation:

$$\frac{\partial L}{\partial x} - \frac{d}{dt} \frac{\partial L}{\partial \dot{x}} = 0$$

where $L(x, \dot{x}, t) = \eta \dot{x}^2 + \lambda \sigma^2 x^2$.

Computing the partial derivatives:

$$\frac{\partial L}{\partial x} = 2 \lambda \sigma^2 x, \quad \frac{\partial L}{\partial \dot{x}} = 2 \eta \dot{x}$$

$$\frac{d}{dt} (2 \eta \dot{x}) = 2 \eta \ddot{x}$$

Equating the terms yields the second-order ordinary differential equation:

$$\ddot{x}(t) - \kappa^2 x(t) = 0$$

where the execution urgency parameter $\kappa$ is defined as:

$$\kappa \equiv \sqrt{\frac{\lambda \sigma^2}{\eta}}$$

### Closed-Form Solution

The general solution to this linear differential equation is:

$$x(t) = A \cosh(\kappa (T - t)) + B \sinh(\kappa (T - t))$$

Applying the terminal boundary condition $x(T) = 0$:
$$A \cosh(0) + B \sinh(0) = A = 0$$

Applying the initial boundary condition $x(0) = X$:
$$B \sinh(\kappa T) = X \implies B = \frac{X}{\sinh(\kappa T)}$$

Thus, the optimal continuous inventory trajectory is:

$$x(t) = \frac{\sinh(\kappa (T - t))}{\sinh(\kappa T)} X$$

The instantaneous trading velocity is:

$$v(t) = -\dot{x}(t) = \kappa \frac{\cosh(\kappa (T - t))}{\sinh(\kappa T)} X$$

---

## Discrete Trajectory in Gosu

In `AlmgrenChrissExecutionEngine.gs`, Fairlead evaluates the exact discrete trajectory for interval $j \in \{0, \dots, N\}$:

```gosu
var kappa = Math.sqrt((_riskAversion * _volatility * _volatility) / _temporaryImpact)
var sinhKT = Math.sinh(kappa * _totalDurationSeconds)
var sinhKRem = Math.sinh(kappa * (_totalDurationSeconds - currentElapsedSeconds))

var targetRemaining = (sinhKRem / sinhKT) * (parentOrder.Quantity as double)
var plannedSlice = Math.max(0L, progress.RemainingQuantity - (targetRemaining as long))
```

### Risk Aversion Limits

1. **Risk-Neutral ($\lambda \to 0$ or $\kappa \to 0$)**:
   $$\lim_{\kappa \to 0} \frac{\sinh(\kappa (T - t))}{\sinh(\kappa T)} = \frac{T - t}{T}$$
   The optimal schedule reduces to a uniform **TWAP** (constant velocity $v = X / T$).

2. **Extreme Risk Aversion ($\lambda \to \infty$ or $\kappa \to \infty$)**:
   The trajectory decays instantaneously at $t = 0^+$, front-loading execution to eliminate all price variance at the expense of maximum market impact.
