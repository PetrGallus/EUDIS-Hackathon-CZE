function out = allocateQuadXNonlinearIterative(T_d, L_d, M_d, N_d, ...
                                               l, omega_init, omega_min, omega_max, ...
                                               thrustFcn, torqueFcn, auxdata, opts)
% allocateQuadXNonlinearIterative
%
% Iterative control allocation for quadrotor X configuration with nonlinear
% thrust/torque relations and no explicit inverse map.
%
% Inputs:
%   T_d, L_d, M_d, N_d   - desired total thrust and moments
%   l                    - arm length [m]
%   omega_init           - [4x1] initial guess for rotor speeds [rad/s]
%   omega_min            - minimum rotor speed [rad/s]
%   omega_max            - maximum rotor speed [rad/s]
%   thrustFcn            - function handle:
%                          T = thrustFcn(omega_i, i, auxdata)
%   torqueFcn            - function handle:
%                          Qmag = torqueFcn(omega_i, i, auxdata)
%                          returned as positive magnitude; sign is applied inside
%   auxdata              - struct with any extra model data
%   opts                 - struct with fields:
%                          .maxIter   (default 30)
%                          .tol       (default 1e-5)
%                          .lambda    (default 1e-3)
%                          .fd_eps    (default 1e-3)
%                          .verbose   (default false)
%
% Output:
%   out.omega            - [4x1] allocated rotor speeds
%   out.W                - achieved wrench [4x1]
%   out.err              - final wrench error
%   out.iter             - iterations used
%   out.converged        - true/false
%   out.T_individual     - [4x1] rotor thrusts
%   out.Q_individual     - [4x1] signed rotor torques
%   out.J                - final Jacobian

    if nargin < 11 || isempty(opts)
        opts = struct();
    end

    if ~isfield(opts, 'maxIter'), opts.maxIter = 30; end
    if ~isfield(opts, 'tol'),     opts.tol = 1e-5; end
    if ~isfield(opts, 'lambda'),  opts.lambda = 1e-3; end
    if ~isfield(opts, 'fd_eps'),  opts.fd_eps = 1e-3; end
    if ~isfield(opts, 'verbose'), opts.verbose = false; end

    a = l / sqrt(2);

    % Motor positions: [x_i, y_i]
    x = [ a;  a; -a; -a];
    y = [-a;  a;  a; -a];

    % Rotor spin signs for yaw torque
    spinSign = [1; -1; 1; -1];

    Wd = [T_d; L_d; M_d; N_d];

    omega = omega_init(:);
    omega = min(max(omega, omega_min), omega_max);

    converged = false;
    J = zeros(4,4);

    for k = 1:opts.maxIter
        [W, T_individual, Q_individual] = computeWrench(omega, x, y, spinSign, ...
                                                        thrustFcn, torqueFcn, auxdata);

        err = Wd - W;

        if opts.verbose
            fprintf('Iter %d: ||err|| = %.6e\n', k, norm(err));
        end

        if norm(err) < opts.tol
            converged = true;
            break;
        end

        % Numerical Jacobian dW/domega
        for j = 1:4
            omega_p = omega;
            omega_p(j) = min(omega_p(j) + opts.fd_eps, omega_max);

            Wp = computeWrenchOnly(omega_p, x, y, spinSign, ...
                                   thrustFcn, torqueFcn, auxdata);

            J(:,j) = (Wp - W) / (omega_p(j) - omega(j) + eps);
        end

        % Damped least-squares step
        delta = (J' * J + opts.lambda * eye(4)) \ (J' * err);

        omega = omega + delta;
        omega = min(max(omega, omega_min), omega_max);
    end

    % Final evaluation
    [W, T_individual, Q_individual] = computeWrench(omega, x, y, spinSign, ...
                                                    thrustFcn, torqueFcn, auxdata);
    err = Wd - W;

    if norm(err) < opts.tol
        converged = true;
    end

    out = struct();
    out.omega        = omega;
    out.W            = W;
    out.err          = err;
    out.iter         = k;
    out.converged    = converged;
    out.T_individual = T_individual;
    out.Q_individual = Q_individual;
    out.J            = J;
end

% -------------------------------------------------------------------------
function [W, T_individual, Q_individual] = computeWrench(omega, x, y, spinSign, ...
                                                         thrustFcn, torqueFcn, auxdata)

    T_individual = zeros(4,1);
    Q_individual = zeros(4,1);

    for i = 1:4
        T_individual(i) = thrustFcn(omega(i), i, auxdata);

        Qmag = torqueFcn(omega(i), i, auxdata);
        Q_individual(i) = spinSign(i) * Qmag;
    end

    % W = [Total thrust; roll; pitch; yaw]
    Ttot = sum(T_individual);
    L    = sum(y .* T_individual);
    M    = sum((-x) .* T_individual);
    N    = sum(Q_individual);

    W = [Ttot; L; M; N];
end

% -------------------------------------------------------------------------
function W = computeWrenchOnly(omega, x, y, spinSign, thrustFcn, torqueFcn, auxdata)
    [W, ~, ~] = computeWrench(omega, x, y, spinSign, thrustFcn, torqueFcn, auxdata);
end