
function out = desiredAttitudeFromAccel(a_cmd_i, m, D_est, g_i, ...
                                        alpha, beta, phi, theta, psi, psi_d)

    % Wind -> body
    R_bw = Rz(beta) * Ry(-alpha);

    % Body -> inertial
    R_ib = Rz(psi) * Ry(theta) * Rx(phi);

    % Wind -> inertial
    R_iw = R_ib * R_bw;

    % Estimated drag in inertial frame
    D_i = R_iw * D_est;

    % Required thrust force in inertial frame
    F_req_i = m * (a_cmd_i - g_i) - D_i;

    T_d = norm(F_req_i);

    if T_d < 1e-9
        error('Desired thrust magnitude is too small; attitude is undefined.');
    end

    % Desired body z-axis (body z is positive down, thrust along -b3)
    b3_d = -F_req_i / T_d;

    % Yaw reference in horizontal plane only
    b1_ref = [cos(psi_d); sin(psi_d); 0];

    c = cross(b3_d, b1_ref);
    nc = norm(c);

    if nc < 1e-9
        error(['b3_d is parallel (or nearly parallel) to yaw reference. ', ...
               'Choose a different psi_d or use fallback logic.']);
    end

    b2_d = c / nc;
    b1_d = cross(b2_d, b3_d);

    R_d = [b1_d, b2_d, b3_d];

    % Extract ZYX Euler angles from R_d
    [phi_d, theta_d, psi_d_out] = rotmToEulerZYX(R_d);

    out = struct();
    out.D_i     = D_i;
    out.F_req_i = F_req_i;
    out.T_d     = T_d;

    out.phi_d   = phi_d;
    out.theta_d = theta_d;
    out.psi_d   = psi_d_out;

    out.R_d     = R_d;
    out.R_iw    = R_iw;

    out.b1_d    = b1_d;
    out.b2_d    = b2_d;
    out.b3_d    = b3_d;
end

function [phi, theta, psi] = rotmToEulerZYX(R)
    theta = -asin(R(3,1));
    phi   =  atan2(R(3,2), R(3,3));
    psi   =  atan2(R(2,1), R(1,1));
end