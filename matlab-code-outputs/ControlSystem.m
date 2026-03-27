
%% Quadcopter control system 

% Inputs: psi, theta, phi, p, q, r, alpha, beta, geometry, weight,
% psi_target, approximate parameters of motor thrusts and torques

% Outputs: Ideally PWM, but for the sake of simulation - motor omega for the
% model directly.

m = 10;
D = [0; 0; 0];
g   = 9.81;

e_eta(:,1) = [0; 0; 0];

i = 1;

Kp_pos = 0;
Kd_pos = 0;



%% Demanded acceleration in the inertial frame

% Aerodynamic/wind frame demanded normal acceleration 
a_aer_d = [0; 0; -5*g]; % Replace with the true normal acceleration in the AERODYNAMIC FRAME

 % Current state
r_i     = x(1:3);
v_i     = x(4:6);
phi     = x(7);
theta   = x(8);
psi     = x(9);
omega_b = x(10:12);

% Desired attitude from acceleration command
g_i = [0; 0; p.g];
alpha = -0 *pi/180;
beta  =  0 *pi/180;

% Aero -> body
R_b_aer = Rz(beta) * Ry(-alpha);

% Body -> inertial (ZYX Euler sequence)
R_ib = Rz(psi) * Ry(theta) * Rx(phi);

% Transform
a_b = R_b_aer * a_aer_d;
a_i = R_ib * a_b;

a_cmd_i = a_i + Kp_pos * (r_d - r_i) ...
              + Kd_pos * (v_d - v_i);


%% Euler angles (or rotation matrix) 

% Set the desired yaw (or roll, if x axis is aligned with the thrust vector).
psi_target = 0 *pi/180;
psi_d = psi_target;  

% Compute derived angles using the thrust vector in inertial frame
thr_angle_set = desiredAttitudeFromAccel(a_cmd_i, m, Dest, [0; 0; g], alpha, beta, phi, theta, psi, psi_d);

% Compute the desired moments based on the derived angles and current state
T_d     = thr_angle_set.T_d; 
phi_d   = thr_angle_set.phi_d;
theta_d = thr_angle_set.theta_d;


%% PD allocation of desired moments to angles

% Compute the Euler angle errors
e_phi   = phi_d   - phi;
e_theta = theta_d - theta;
e_psi   = psi_d   - psi;

e_eta(:,i+1) = [e_phi   ;
                e_theta ;
                e_psi]  ;

% Compute the error derivatives using Euler discretization
e_eta_dot = (e_eta(:,i+1) - e_eta(:,i)) / dt; 

% % For zero desired angular velocities
% e_eta_dot = -omega_b;

% PD controller gain matrices (TUNE)
Kp = diag([8.0, 8.0, 4.0]);
Kd = diag([2.5, 2.5, 1.2]);

% Compute the moments according to the angle errors (PD control)
M_d_b = eulerPDToMoments(e_eta(:,i+1), e_eta_dot, Kp, Kd);

L_d = M_d_b(1); 
M_d = M_d_b(2); 
N_d = M_d_b(3); 

% disp(M_d_b);



%% Control allocation (thrust and torque -> motor RPM)

% ------------------------------------------------------------------
%  Option 1 - LINEAR allocation (approximate)
% We assume that T = kT*omega^2 and Q = kQ*omega^2. 

% Set the approximate thrust and torque coefficients
kQ = 0.101;
kM = 1.8225e-05;
l  = 1;

% Set motor RPM limits for clamping
omega_min = 0;
omega_max = 10000 / 60;

[omega_m_d, omega_sq, T_individual, Q_individual, B] = ...
    allocateQuadXLinear(T_d, L_d, M_d, N_d, kQ, kM, l, omega_min, omega_max);



% %  -----------------------------------------------------------------
% %  Option 2 - NONLINEAR allocation (using the maps)
% % We use the full nonlinear map [T,Q] = f(omega, flight conditions). 
% % The omega is allocated nonlinearly. Can be also used to allocate PWM from
% % the maps. 
% 
% % Initial guess of omega (or PWM) - can be the current value
% omega_init = 100 * ones(4,1);
% omega_min  = 0;
% omega_max  = 10000 / 60;
% 
% % Data describing the parameters of the thrust map, e.g., interpolation
% % knots / grid data. 
% auxdata = 1;
% 
% out = allocateQuadXNonlinearIterative(T_d, L_d, M_d, N_d, ...
%                                       l, omega_init, omega_min, omega_max, ...
%                                       @exampleThrustFcn, @exampleTorqueFcn, auxdata, opts);
% 
% omega_m_d = out.omega;




%% Motor control
%  -----------------------------------------------------------
% Option 1 - We have atleast some feedback of motor RPMs - PI controller

% PI controller for motors 
e_m = [omega_m_d(1) - omega_m(1);
       omega_m_d(2) - omega_m(2);
       omega_m_d(3) - omega_m(3);
       omega_m_d(4) - omega_m(4)];

if clamp == 0
    e_mi = e_mi + e_m*dt;
end

% Gains
Kpm = 5;
Kim = 2;

% Saturate to stay in the feasible PWM limit
PWMnorm = min(max(Kpm*e_m + Kim*e_mi, 0), 1); 

% Saturation flag for clamping
if any((PWMnorm - 0) < 1e-6) || any((PWMnorm - 1) < 1e-6)
    clamp = 1;
else
    clamp = 0;
end


%  --------------------------------------------------------
% Option 2 - direct relation between the thrust and torque and PWM is known
% If PWM is the output of the controller - the thrust is approximately
% linear function of the PWM, so PWMnorm = T*u_TM. 

% Conversion between thrusts, torques, and PWM 
kQ = 1; kM = 1; % Obtained from approximation

T = [ kQ,      kQ,      kQ,      kQ  ; 
     -a*kQ,    a*kQ,    a*kQ,   -a*kQ;
     -a*kQ,   -a*kQ,    a*kQ,    a*kQ;
      kM,     -kM,      kM,     -kM  ]; 

PWMnorm = T*[T_d; L_d; M_d; N_d];


%  ----------------------------------------------------------
% Option 3 - simulate the OMEGAd -> PWM -> OMEGA chain as a first-order
% lag.

omega_m = (1 - dt/Tm)*omega_m + dt/Tm*omega_m_d; 
