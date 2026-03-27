

function out = simulateQuadMinimalICAO()
% Minimal 6-DoF quadrotor simulation for validation
% ICAO / NED-like convention:
%   inertial: x forward, y right, z down
%   body:     x forward, y right, z down
%
% Assumptions:
%   - thrust acts along -b3
%   - no drag
%   - no motor dynamics
%   - no sensor dynamics
%   - simple Euler-angle PD inner loop
%   - linear control allocation: T_i = kQ*omega_i^2, Q_i = kM*omega_i^2
%
% Notes:
%   - Here kQ is treated as THRUST coefficient, per your notation.
%   - l is the arm length from CoM to rotor center.
%   - If your real l=1 is not in meters, replace it accordingly.

    clc;

    % ------------------------------------------------------------
    % Parameters
    % ------------------------------------------------------------
    p.m  = 0.5;               % kg
    p.g  = 9.81;              % m/s^2
    p.J  = diag([0.007 0.007 0.012]);   % kg m^2, engineering guess
    p.kT = 8.5486e-06;             % thrust coeff: T_i = kQ*omega_i^2
    p.kM = 1.8225e-05;        % reaction torque coeff: Q_i = kM*omega_i^2
    p.l  = 0.17;               % arm length; check your units
    p.a  = p.l / sqrt(2);     % X configuration moment arm
    p.cD = 0.002;

    % Rotor limits
    p.omega_min = 0.0;
    p.omega_max = 1000.0;      % adjust if needed

    % Attitude PD gains
    p.Kp_att = diag([8.0, 8.0, 4.0]);
    p.Kd_att = diag([2.5, 2.5, 1.2]);

    % Position / accel outer-loop gains
    p.Kp_pos = 1*0.4*diag([1, 1, 1]);
    p.Kd_pos = 1*2*diag([1, 1, 1]);

    % Yaw hold
    p.psi_d = 0 * pi/180;

    % ------------------------------------------------------------
    % Simulation settings
    % ------------------------------------------------------------
    dt = 0.001;
    Tf = 100;
    t  = 0:dt:Tf;
    N  = numel(t);

    % State:
    % x = [r_i(3); v_i(3); euler(3); omega_b(3)]
    x = zeros(12,1);

    % Initial condition
    % [x;y;z] in inertial NED-like frame, so +z is downward
    x(1:3)   = [0; 0; 0];
    x(4:6)   = [0; 0; 0];
    x(7:9)   = [0; 0; 0] *pi /180;     % phi, theta, psi
    x(10:12) = [0; 0; 0];     % p, q, r

    % Storage
    X       = zeros(12,N);
    U       = zeros(4,N);  % [T; L; M; N]
    OMEGA   = zeros(4,N);
    EULER_D = zeros(3,N);
    ACC_CMD = zeros(3,N);

    % Previous angle error for numerical derivative
    e_eta(:,1) = zeros(3,1);

    % ------------------------------------------------------------
    % Main loop
    % ------------------------------------------------------------
    for i = 1:N
        tk = t(i);

        % Current state
        r_i     = x(1:3);
        v_i     = x(4:6);
        phi     = x(7);
        theta   = x(8);
        psi     = x(9);
        omega_b = x(10:12);

        % Desired attitude from acceleration command
        g_i = [0; 0; p.g];
        D_w = [0; 0; 0  ];
        alpha = -0 *pi/180;
        beta  =  0 *pi/180;

        if tk < 10
            a_aer_d = [0; 0; 0]*p.g; % In g
        elseif tk >= 10 && tk < 15
            a_aer_d = [0; 0; 0]*p.g; % In g
        else
            a_aer_d = [0; 0; 0]*p.g; % In g
        end

        % Aero -> body
        R_b_aer = Rz(beta) * Ry(-alpha);
        
        % Body -> inertial (ZYX Euler sequence)
        R_ib = Rz(psi) * Ry(theta) * Rx(phi);
        
        % Transform
        a_b = R_b_aer * a_aer_d;
        a_i = R_ib * a_b;
    
       
        % Desired position trajectory for validation
        [r_d, v_d, a_ff] = referenceTrajectory(tk, a_i);

        % V_d = 100; 
        % v_d = V_d*[cos(psi)*cos(theta);
        %            sin(psi)*cos(theta);
        %            -sin(theta)];

        % Outer loop -> commanded inertial acceleration
        % ICAO/NED: z positive down
        a_cmd_i = a_i ...
                + p.Kp_pos * (r_d - r_i) ...
                + p.Kd_pos * (v_d - v_i);

        
        att = desiredAttitudeFromAccel( ...
            a_cmd_i, p.m, D_w, g_i, alpha, beta, phi, theta, psi, p.psi_d);

        % Compute the angle errors
        phi_d   = att.phi_d  ;
        theta_d = att.theta_d;
        psi_d   = att.psi_d  ;
        T_d     = att.T_d    ;        

        e_phi   = phi_d   - phi;
        e_theta = theta_d - theta;
        e_psi   = psi_d   - psi;
        
        % 
        e_eta(:,i+1) = [e_phi   ;
                        e_theta ;
                        e_psi]  ;
        
        % Compute the error derivatives using Euler discretization
        e_eta_dot = (e_eta(:,i+1) - e_eta(:,i)) / dt; 


        % Inner loop PD using numerical derivative of angle error
        M_d_b = eulerPDToMoments(e_eta(:,i+1), e_eta_dot, p.Kp_att, p.Kd_att);

        L_d = M_d_b(1);
        M_d = M_d_b(2);
        N_d = M_d_b(3);

        % Control allocation
        [omega, omega_sq, T_i, Q_i] = allocateQuadXLinear( ...
            T_d, L_d, M_d, N_d, p.kT, p.kM, p.l, p.omega_min, p.omega_max);

        % Achieved inputs after allocation saturation
        T_act = sum(T_i);
        tau_b = [
            p.a * (-T_i(1) + T_i(2) + T_i(3) - T_i(4));
            p.a * (-T_i(1) - T_i(2) + T_i(3) + T_i(4));
                  ( Q_i(1) - Q_i(2) + Q_i(3) - Q_i(4))
        ];

        % Integrate dynamics
        [xdot, Dmag] = quadDynamicsICAO(x, T_act, tau_b, p, alpha, beta);
        x    = x + dt * xdot;

        % Save
        X(:,i)        = x;
        U(:,i)        = [T_act; tau_b];
        OMEGA(:,i)    = omega;
        EULER_D(:,i)  = [phi_d; theta_d; psi_d];
        ACC_CMD(:,i)  = a_i; % a_cmd_i;
        ACC(:,i) = xdot(4:6,:);
        DMAG(i) = Dmag;
    end

    % ------------------------------------------------------------
    % Package output
    % ------------------------------------------------------------
    out.t        = t;
    out.X        = X;
    out.U        = U;
    out.OMEGA    = OMEGA;
    out.EULER_D  = EULER_D;
    out.ACC_CMD  = ACC_CMD;
    out.params   = p;
    out.D        = DMAG;

    % ------------------------------------------------------------
    % Plots
    % ------------------------------------------------------------
    makePlots(out);
end

% ========================================================================
% Reference trajectory
% ========================================================================
function [r_d, v_d, a_ff] = referenceTrajectory(t, a_i)
% Simple validation maneuver in inertial frame (ICAO/NED-like)
%
% 0-2 s: hover at origin
% 2-5 s: command forward motion
% 5-8 s: command rightward motion and mild climb (negative z in NED)


    if t < 5
        r_d  = [0; 0; 0];
        v_d  = [0; 0; 0];
        a_ff = [0; 0; 0]*9.81;
    elseif t >= 5 && t < 50
        r_d  = [50; 50;  0];
        v_d  = [0; 0;  0];
        a_ff = [0; 0;  0]*9.81;
    % elseif t >= 10 && t < 15
    %     r_d  = [50; 50; 50];
    %     v_d  = [0; 0; 0];
    %     a_ff = [0; 0; 0]*9.81;
    % elseif t >= 15 && t < 20
    %     r_d  = [50; 50; 0];
    %     v_d  = [0; 0; 0];
    %     a_ff = [0; 0; 0]*9.81;
    else 
        r_d  = [50; 50; 50];
        v_d  = [0; 0; 0];
        a_ff = [0; 0; 0]*9.81;
    end
end



% ========================================================================
% Rigid-body dynamics
% ========================================================================
function [xdot, Dmag] = quadDynamicsICAO(x, T, tau_b, p, alpha, beta)

    r_i     = x(1:3);
    v_i     = x(4:6);
    phi     = x(7);
    theta   = x(8);
    psi     = x(9);
    omega_b = x(10:12);      

    D_aer = -p.cD * 1.2 * 0.2^2 * (v_i).^2;

    R_b_aer = Rz(beta) * Ry(-alpha);                           
    R_ib = Rz(psi) * Ry(theta) * Rx(phi);

     % Transform
    D_b = R_b_aer * D_aer;
    D_i = R_ib * D_b;

    Dmag = norm(D_i);

    % Translational dynamics in inertial frame
    % gravity positive down
    g_i = [0; 0; p.g];

    % thrust in body frame acts along -b3
    F_thrust_b = [0; 0; -T];
    F_thrust_i = R_ib * F_thrust_b;

    rdot = v_i;
    vdot = g_i + (F_thrust_i + D_i) / p.m;

    % Rotational dynamics in body frame
    omega_dot = p.J \ (tau_b - cross(omega_b, p.J * omega_b));

    % Euler-angle kinematics (ZYX, ICAO body axes)
    p_rate = omega_b(1);
    q_rate = omega_b(2);
    r_rate = omega_b(3);

    E = [1,  sin(phi)*tan(theta),  cos(phi)*tan(theta);
         0,  cos(phi),            -sin(phi);
         0,  sin(phi)/cos(theta),  cos(phi)/cos(theta)];

    euler_dot = E * [p_rate; q_rate; r_rate];

    xdot = [rdot;
            vdot;
            euler_dot;
            omega_dot];
end


% ========================================================================
% Plotting
% ========================================================================
function makePlots(out)
    t = out.t;
    X = out.X;
    U = out.U;
    O = out.OMEGA;
    EULER_D = out.EULER_D;
    D = out.D;

    figure;
    plot3(X(2,:), X(1,:), -X(3,:), 'LineWidth', 1.8); grid on;
    xlabel('y_i [m]');
    ylabel('x_i [m]');
    zlabel('-z_i [m]');
    title('Trajectory (visualized with up positive in plot)');

    figure;
    subplot(3,1,1);
    plot(t, X(1,:), t, X(2,:), t, X(3,:), 'LineWidth', 1.4); grid on;
    legend('x','y','z','Location','best');
    title('Position in inertial frame');

    subplot(3,1,2);
    plot(t, X(4,:), t, X(5,:), t, X(6,:), 'LineWidth', 1.4); grid on;
    legend('v_x','v_y','v_z','Location','best');
    title('Velocity in inertial frame');

    subplot(3,1,3);
    plot(t, rad2deg(X(7,:)), t, rad2deg(X(8,:)), t, rad2deg(X(9,:)), ...
         t, rad2deg(EULER_D(1,:)), '--', ...
         t, rad2deg(EULER_D(2,:)), '--', ...
         t, rad2deg(EULER_D(3,:)), '--', 'LineWidth', 1.2); grid on;
    legend('\phi','\theta','\psi','\phi_d','\theta_d','\psi_d','Location','best');
    title('Actual and desired Euler angles [deg]');

    figure;
    subplot(2,1,1);
    plot(t, [U(1,:); D], 'LineWidth', 1.4); grid on;
    title('Total thrust');

    subplot(2,1,2);
    plot(t, U(2,:), t, U(3,:), t, U(4,:), 'LineWidth', 1.4); grid on;
    legend('L','M','N','Location','best');
    title('Body moments');

    figure;
    plot(t, O, 'LineWidth', 1.3); grid on;
    legend('\omega_1','\omega_2','\omega_3','\omega_4','Location','best');
    title('Rotor speeds');
end